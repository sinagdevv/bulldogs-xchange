# REST API

Public: `GET /api/health`, `/api/config/public`, `/api/categories`, `/api/products`, `/api/products/:id`, `/api/products/:id/variants`, `/api/products/:id/availability`.

Authenticated: `GET /api/me`, `/api/profile`, `/api/reservations`, `/api/reservations/:id`, `/api/notifications`; `POST /api/reservations`, `/api/reservations/:id/cancel`, `/api/queue/join`, `/api/queue/leave`; `GET /api/queue/me`, `/api/queue/status`. Notification read-state writes currently work only with the mock provider, not SQL Server.

Staff/admin: dashboard, reservation status operations, queue action, inventory adjustment/restock/movements, transactions, and alerts under `/api/staff/*`.

Admin: read endpoints for dashboard, products, categories, variants, inventory, reservations, queue, transactions, users, audit logs, and settings, plus analytics at `/api/admin/analytics/{summary,sales,reservations,products,inventory,queue}`. Admin mutation routes are placeholders and do not persist changes yet.

Catalog query parameters: `search`, `category`, `featured`, `active`, `sort` (`title`, `price`, `-price`).

SQL retryable writes (`POST /api/reservations`, inventory restock, and transaction processing) require `Idempotency-Key`. Inventory adjustment uses an explicit signed `changeQty` delta; it never changes reserved quantity.

Export TODO: CSV, Excel, PDF, email delivery, and scheduled reports are domain contracts only.
