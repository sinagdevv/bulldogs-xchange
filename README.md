# Bulldogs Xchange backend

Backend foundation for an on-campus merchandise reservation and pickup system. It exposes framework-free REST endpoints as Vercel Functions; the future HTML/CSS/JavaScript frontend can consume them directly.

## Architecture

`Web/PWA` → `Vercel REST API` → `Microsoft SQL Server` → `transactional outbox` → `Power Automate` → `Outlook`

SQL Server is the primary system of record for operational state. Power Automate handles notification and scheduled-automation side effects; browser-facing code must never call it directly. SharePoint is not the primary operational database, and Excel is reporting/export only. All fulfillment is campus pickup; shipping and delivery workflows are intentionally absent.

## Setup

```sh
npm install
copy .env.example .env.local
npm run dev
```

Set `ENABLE_DEV_AUTH=true` and `DEV_AUTH_EMAIL=customer@example.test` only for local testing. You may also send `x-dev-user` with one of the fake accounts. Never enable this in production.

Production authentication validates provider-issued OIDC bearer tokens and maps their verified email to the SQL Users table; SQL remains authoritative for activation and roles. Configure `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, and `FRONTEND_ORIGIN`. See [Production authentication](docs/authentication.md).

Production defaults to `DATA_PROVIDER=sqlserver`. SharePoint, Power Automate repository, and in-memory providers remain legacy/development adapters; production never falls back to mock mode.

The transactional outbox has validated real Outlook delivery through `BX-NotifyEvent` for `ReservationCreated`, `ReservationReady`, `QueueCalled`, `TransactionCompleted`, and `ReservationCancelled`. `PA_NOTIFY_EVENT_URL` and `BX_AUTOMATION_SECRET` are server-only. See [Power Automate contracts](docs/power-automate-contracts.md).

## Scripts

- `npm run dev` — local Vercel runtime
- `npm run typecheck` — TypeScript validation
- `npm test` — focused business-rule tests
- `npm run build` — compile the server functions
- `npm run outbox:dispatch` — claim and dispatch one bounded outbox batch

## API

Routes use `{ success, data, reference, message }` or `{ success: false, error }`. See [docs/api.md](docs/api.md). All fulfillment is campus pickup; shipping is intentionally absent.

## Vercel

Configure server-only SharePoint and Power Automate values from `.env.example` in Vercel, choose a production identity provider, then run `vercel --prod`. Do not expose workflow URLs to browser code.

## Deferred

Production identity, CSV/Excel/PDF exports, scheduled reports, chatbot, and final frontend.
