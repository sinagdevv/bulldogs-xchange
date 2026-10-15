# Refundable deposit workflow (prepared, disabled)

The PHP 200 refundable-deposit policy is not active. Migration `20261011090000_deposit_expiration.sql` is prepared but must not be applied until the institution approves the policy. Even after migration, `DepositWorkflowEnabled=false` keeps creation and expiration behavior unchanged.

## Lifecycle

1. Reservation creation calculates the order total from server prices. Proposed deposit is `min(PHP 200, order total)` and is stored once; money is `numeric(12,2)` in PostgreSQL and converted to integer cents in application validation.
2. The customer submits a payment reference plus allowlisted evidence metadata. Submission means **Submitted for Verification**, never paid or verified.
3. Staff/Admin compares the evidence with the actual payment record. A serializable transaction changes the deposit to **Verified**, changes a `Pending Deposit` reservation to **Confirmed**, writes one audit event, and enqueues one notification event.
4. Pickup charges the server-computed order total less only a verified deposit. Existing `Transactions` remains the final-sale record; a reservation or deposit is never reported as revenue.
5. Cancellation or expiration may create one `Refund Pending` record. An operator records the external payout reference and evidence before the refund becomes **Refunded**. No provider payout is performed by this application.

Reservation, deposit, refund, queue, and transaction states remain separate. Existing reservations retain their current status and have null deposit/deadline columns.

## Proposed API contracts

All endpoints return the existing `{success,data,message,reference}` envelope. They remain unavailable until the migration is applied and the feature gate is explicitly enabled.

| Method and route | Role | Purpose |
|---|---|---|
| `GET /api/customer/reservations/:id/deposit` | owning Customer | Required amount, deadlines, status, verified credit, remaining balance and refund status |
| `POST /api/customer/reservations/:id/deposit/submission` | owning Customer | Submit amount, payment method/reference and evidence metadata |
| `GET /api/staff/deposits?status=&startDate=&endDate=&page=` | Staff/Admin | Verification queue |
| `POST /api/staff/deposits/:id/verify` | Staff/Admin | Verify an externally confirmed deposit; requires `Idempotency-Key` |
| `POST /api/staff/deposits/:id/reject` | Staff/Admin | Reject with a required reason |
| `GET /api/admin/refunds?status=&page=` | Admin | Refund queue and reconciliation |
| `POST /api/admin/refunds/:id/complete` | Admin | Record completed payout reference/evidence; requires `Idempotency-Key` |
| `POST /api/admin/refunds/:id/fail` | Admin | Record a failed payout attempt and reason |
| `GET/PUT /api/admin/settings/deposit-policy` | Admin | Read/update policy only after policy approval |
| `POST /api/internal/reservations/expire` | scheduler secret | Idempotent bounded expiration batch |

Evidence input contains only file name, content type, byte size, SHA-256, and a private storage object identifier. It must not contain account credentials, full card/bank details, access URLs, or tokens.

## Expiration and operating days

- Deposit deadline: creation timestamp plus 24 hours.
- Pickup deadline: same local time after three Asia/Manila campus operating days.
- Saturdays, Sundays, and dates in `dbo.CampusClosures` do not count.
- The scheduled job runs server-side, locks each candidate, verifies its current status/deadline, releases stock only when `InventoryReleasedAt` is null, then records `ExpiredAt` in the same transaction.
- A unique deposit/refund relationship and status guards make retries safe. Concurrent jobs serialize on the reservation row.

Recommended scheduler: Vercel Cron calling the internal endpoint every 15 minutes with `OUTBOX_DISPATCH_SECRET`-style authentication. Supabase Cron is also viable, but application-owned expiration keeps inventory, audit, outbox, and refund creation in one tested transaction. The scheduler owns timing only; Power Automate owns notification delivery only.

## Automation events

The backend commits business state and an outbox event atomically. Power Automate receives bounded identifiers and presentation data, never payment evidence or credentials. Event identity is the outbox `EventId`; retries must acknowledge the same ID.

Prepared names: `RESERVATION_CREATED`, `DEPOSIT_REQUIRED`, `DEPOSIT_SUBMITTED`, `DEPOSIT_VERIFIED`, `DEPOSIT_REJECTED`, `RESERVATION_CONFIRMED`, `RESERVATION_READY`, `PICKUP_REMINDER`, `RESERVATION_EXPIRED`, `REFUND_REQUESTED`, `REFUND_COMPLETED`, `REFUND_FAILED`, `LOW_STOCK_ALERT`.

## Recovery and rollback

Before applying the migration, back up Reservations, ReservationStatuses, SystemSettings, PaymentMethods, Inventory, AutomationOutbox, and AuditLogs. The migration only adds a status, nullable columns, new tables/indexes, and disabled settings; it does not backfill or transition records. Rollback may drop the new objects only while the feature is disabled and the new tables are empty. Once financial records exist, rollback must preserve them and use a forward migration.

## Approval gates

Separate approval is required for: the PHP 200/capped-at-order-total policy; payment deadline; operating-day calendar ownership; accepted payment methods/evidence retention; roles allowed to verify deposits/process refunds; cancellation/refund rules; migration application; enabling the feature; scheduler provisioning; evidence storage; Power Automate flow changes; and any real payment-provider integration.
