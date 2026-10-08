# Bulldogs Xchange backend

Backend foundation for an on-campus merchandise reservation and pickup system. It exposes framework-free REST endpoints as Vercel Functions; the future HTML/CSS/JavaScript frontend can consume them directly.

## Architecture

`Web/PWA` → `Vercel REST API` → `Supabase Postgres` → `transactional outbox` → `Power Automate` → `Outlook`

Supabase Postgres is the normalized SQL operational database used for deployment. It replaces the local-only SQL Server deployment dependency while preserving the validated SQL Server provider. Power Automate handles side effects only; the backend API is the sole operational data writer. See [database documentation](docs/database-supabase.md).

## Setup

```sh
npm install
copy .env.example .env.local
npm run dev
```

Set `ENABLE_DEV_AUTH=true` and `DEV_AUTH_EMAIL=customer@example.test` only for local testing. You may also send `x-dev-user` with one of the fake accounts. Never enable this in production.

Production authentication validates provider-issued OIDC bearer tokens and maps their verified email to the SQL Users table; SQL remains authoritative for activation and roles. Configure `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`, and `FRONTEND_ORIGIN`. See [Production authentication](docs/authentication.md).

Production defaults to `DATA_PROVIDER=supabase`; `postgres` is an alias. Configure `SUPABASE_DATABASE_URL` with the Supabase transaction pooler URL and `POSTGRES_SSL=true`. SQL Server remains selectable with `DATA_PROVIDER=sqlserver`; production never falls back to mock mode.

The transactional outbox has validated real Outlook delivery through `BX-NotifyEvent` for `ReservationCreated`, `ReservationReady`, `QueueCalled`, `TransactionCompleted`, and `ReservationCancelled`. `PA_NOTIFY_EVENT_URL` and `BX_AUTOMATION_SECRET` are server-only. See [Power Automate contracts](docs/power-automate-contracts.md).

## Scripts

- `npm run dev` — local Vercel runtime
- `npm run typecheck` — TypeScript validation
- `npm test` — focused business-rule tests
- `npm run build` — compile the server functions
- `npm run outbox:dispatch` — claim and dispatch one bounded outbox batch
- `npm run db:pg:schema` / `db:pg:seed` / `db:pg:integrity` — provision and verify Postgres
- `npm run test:pg` — rollback-only Postgres smoke test (skips clearly without credentials)

## API

Routes use `{ success, data, reference, message }` or `{ success: false, error }`. See [docs/api.md](docs/api.md). All fulfillment is campus pickup; shipping is intentionally absent.

## Vercel

Configure `DATA_PROVIDER=supabase`, `SUPABASE_DATABASE_URL`, `POSTGRES_SSL=true`, Auth0 values, and server-only automation secrets in Vercel. Vercel can reach Supabase's pooler; it cannot reach localhost SQL Server. Do not expose database credentials, service-role keys, or workflow URLs to browser code.

## Deferred

Production identity, CSV/Excel/PDF exports, scheduled reports, chatbot, and final frontend.
