# BULLDOGS XCHANGE AUTHENTICATION COMPLETION

## Overall

PASS WITH ISSUES — implementation is complete; a real Auth0 browser login has not been run.

## Auth0

- Configuration: local backend values are issuer `https://dev-xdtaoizdcfggpi48.us.auth0.com/`, audience `https://api.bulldogs-xchange.local`, and its matching HTTPS JWKS URL. The SPA Client ID is not configured locally.
- Frontend integration: Auth0 SPA SDK, Authorization Code with PKCE, callback handling, token acquisition, logout, memory-only cache, session loading, onboarding, and SQL-role navigation are connected.
- JWT verification: RS256, issuer, audience, expiry, HTTPS JWKS, email, and `email_verified=true` are enforced.
- Live login: not tested; production login is not yet validated.

## User Provisioning

- Customer registration: verified-token identity only; server-selected Customer role; profile validation; transactional duplicate email/school-ID checks; audit row.
- Admin bootstrap: `AUTH0_BOOTSTRAP_TOKEN` plus an exact operator approval phrase, matching verified token identity, zero-active-Admin guard, exact idempotency, and an audit row.
- Staff role management: use the existing Admin-only role endpoint. It already rejects inactive targets, protects the final Admin, and audits changes.
- Duplicate protection: database unique constraints plus transactional checks.

Run the first-Admin command only after reviewing the identity and approving the mutation:

```powershell
$env:AUTH0_BOOTSTRAP_TOKEN='<short-lived verified access token>'
npm run auth:bootstrap-admin -- --email=user@example.edu --school-id=2026-0001 --name="Full Name" --approve="CREATE INITIAL ADMIN user@example.edu"
```

The command is not an Auth0 account creator and does not print the token. Remove `AUTH0_BOOTSTRAP_TOKEN` from the shell afterward. Staff onboarding is Customer registration followed by the existing Admin-only role change.

## Security

- Verified emails: required in access tokens.
- Role enforcement: SQL only; client/provider roles do not grant access.
- Production fallback: development auth and the mock provider fail closed in production.
- Session handling: bearer token in memory; no database password, client secret, or token localStorage.
- CORS: exact `FRONTEND_ORIGIN`; no wildcard.

## Validation

See the handoff report for the latest test/build/typecheck/lint results.

## Remaining Configuration

1. Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE` in the frontend deployment.
2. In Auth0, register the exact development and production origins under Allowed Callback URLs, Allowed Logout URLs, and Allowed Web Origins. The SDK callback is the origin root.
3. Confirm the Post Login Action adds top-level `email` and boolean `email_verified` claims to the API access token.
4. Set production `FRONTEND_ORIGIN` to the exact deployed frontend origin; the local value is currently `http://localhost:3000`.
5. Run `docs/auth-live-validation.md` with real verified Auth0 identities and retain only redacted evidence.

## Login troubleshooting

- Redirect mismatch: make the browser origin exactly match Auth0 Allowed Callback URLs.
- Logout refusal: add the same origin to Allowed Logout URLs.
- Silent token failure: add the origin to Allowed Web Origins and confirm the requested audience.
- API `401`: check issuer (including trailing slash), audience, JWKS URL, expiry, and required email claims.
- `onboardingRequired: true`: the verified email has no SQL user; complete Customer registration.
- `INACTIVE_USER`: an Admin/operator must reactivate the SQL record; signing in again does not bypass it.

## Next Phase

Power Automate integration validation.
