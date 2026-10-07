# Bulldogs Xchange backend

Backend foundation for an on-campus merchandise reservation and pickup system. It exposes framework-free REST endpoints as Vercel Functions; the future HTML/CSS/JavaScript frontend can consume them directly.

## Architecture

`api` → validation/authorization → services → repository contracts → SharePoint, Power Automate, or local mock adapters.

SharePoint reads use Microsoft Graph with application authentication; the in-memory adapter remains available for development. Services depend on the same asynchronous repository contract. Development authentication is opt-in and refuses to run when `NODE_ENV` or `VERCEL_ENV` is `production`.

## Setup

```sh
npm install
copy .env.example .env.local
npm run dev
```

Set `ENABLE_DEV_AUTH=true` and `DEV_AUTH_EMAIL=customer@example.test` only for local testing. You may also send `x-dev-user` with one of the fake accounts. Never enable this in production.

Set `DATA_PROVIDER=sharepoint` for real reads and configure the site, tenant, client ID, and client secret from `.env.example`. The Entra application needs `Sites.Selected` access granted to the site (or an appropriate broader Graph application permission). Optional list IDs avoid name resolution. Tokens and list IDs are cached only in memory. Production never falls back to mock mode.

The production SharePoint adapter is read-only. Business writes remain mock-only until their existing Power Automate workflows are connected.

## Scripts

- `npm run dev` — local Vercel runtime
- `npm run typecheck` — TypeScript validation
- `npm test` — focused business-rule tests
- `npm run build` — compile the server functions

## API

Routes use `{ success, data, reference, message }` or `{ success: false, error }`. See [docs/api.md](docs/api.md). All fulfillment is campus pickup; shipping is intentionally absent.

## Vercel

Configure server-only SharePoint and Power Automate values from `.env.example` in Vercel, choose a production identity provider, then run `vercel --prod`. Do not expose workflow URLs to browser code.

## Deferred

Production identity and integrations, CSV/Excel/PDF/email exports, scheduled reports, chatbot, and final frontend.
