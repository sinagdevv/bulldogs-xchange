# Bulldogs Xchange backend

Backend foundation for an on-campus merchandise reservation and pickup system. It exposes framework-free REST endpoints as Vercel Functions; the future HTML/CSS/JavaScript frontend can consume them directly.

## Architecture

`api` → validation/authorization → services → repository contracts → SharePoint, Power Automate, or local mock adapters.

SharePoint is the intended operational data source. The current in-memory adapter contains a few clearly fake records for development only. Development authentication is opt-in and refuses to run when `NODE_ENV` or `VERCEL_ENV` is `production`.

## Setup

```sh
npm install
copy .env.example .env.local
npm run dev
```

Set `ENABLE_DEV_AUTH=true` and `DEV_AUTH_EMAIL=customer@example.test` only for local testing. You may also send `x-dev-user` with one of the fake accounts. Never enable this in production.

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

