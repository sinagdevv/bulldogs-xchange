# Live Auth0 validation

Do not run this plan until the Auth0 tenant, API, SPA application, verified-email Action, production origin, and reachable SQL Server are configured. Use short-lived tokens and never save or log them. Do not dispatch the outbox, call Power Automate, send email, or mutate lifecycle records while validating authentication.

## Preconditions

1. Deploy the backend with `NODE_ENV=production`, `ENABLE_DEV_AUTH=false`, `DATA_PROVIDER=sqlserver`, and all required Auth0/SQL variables.
2. Confirm `AUTH_ISSUER` is the token's exact `iss`, `AUTH_AUDIENCE` is present in `aud`, and `AUTH_JWKS_URL` uses HTTPS.
3. Confirm the Auth0 access token contains `sub`, normalized-testable `email`, and `email_verified: true`.
4. Create Auth0 identities whose verified emails match the chosen active SQL Customer, Staff, and Admin rows. Create separate temporary identities/SQL fixtures for unknown and inactive tests; do not change production roles to manufacture cases.
5. Use `/api/me` for the basic authentication checks. Use only read-only role endpoints for authorization checks: a customer-owned GET endpoint, `/api/staff/dashboard`, and `/api/admin/dashboard`.

## Test sequence

### A. Unauthenticated request

Call `GET /api/me` without `Authorization`. Expect HTTP `401` and error code `UNAUTHORIZED`.

### B. Valid Auth0 identity with no SQL user

Use a valid token whose verified email has no `dbo.Users` row. Expect HTTP `403` and error code `FORBIDDEN`.

### C. Inactive SQL user

Use a valid token matching a pre-existing inactive SQL fixture. Expect HTTP `403` and error code `INACTIVE_USER`.

### D. Customer

Use a valid token matching the active Customer row.

1. `GET /api/session`: expect `authenticated: true` and SQL-backed role `Customer`.
2. Call a customer-owned GET endpoint: expect success only for that customer's data.
3. `GET /api/staff/dashboard`: expect `403 FORBIDDEN`.
4. `GET /api/admin/dashboard`: expect `403 FORBIDDEN`.

### E. Staff

Use a valid token matching the active Staff row.

1. `GET /api/session`: expect SQL-backed role `Staff`.
2. `GET /api/staff/dashboard`: expect success.
3. `GET /api/admin/dashboard`: expect `403 FORBIDDEN`.

### F. Admin

Use a valid token matching the active Admin row.

1. `GET /api/session`: expect SQL-backed role `Admin`.
2. `GET /api/admin/dashboard`: expect success.

### G. Invalid audience

Send an otherwise valid RS256 token issued for a different API audience. Expect `401 UNAUTHORIZED`.

### H. Invalid issuer

Send an otherwise valid token from a different Auth0 tenant/domain. Expect `401 UNAUTHORIZED`.

### I. Expired token

Send an expired token. Expect `401 UNAUTHORIZED`.

### J. Provider role metadata manipulation

Give the Customer Auth0 user an Auth0 role or metadata value claiming `Admin`, then obtain a fresh access token. Expect `/api/session` to remain `Customer`, staff/admin endpoints to remain `403`, and SQL `dbo.Users.RoleId` to remain authoritative.

## Evidence to retain

Record only timestamp, deployed commit, endpoint, HTTP status, safe error code, SQL role expected/observed, and pass/fail. Redact bearer tokens, cookies, Auth0 IDs not needed for diagnosis, SQL credentials, automation URLs, and secrets.
