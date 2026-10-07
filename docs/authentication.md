# Production authentication

Bulldogs Xchange uses a provider-independent OIDC bearer-token boundary:

`Web/PWA → OIDC provider (Authorization Code + PKCE) → Bearer access token → Vercel API → JWT/JWKS validation → SQL Users lookup → role authorization`

This fits Vercel without requiring Microsoft Entra or NU tenant administration. Auth0 is the initial provider; the boundary remains standard OIDC. The API uses `jose` to validate the token signature, issuer, audience, expiry, and RS256 algorithm against the provider's HTTPS JWKS. The token must contain `sub`, `email`, and `email_verified: true`; configure the Auth0 API token to include those identity claims. The normalized verified email maps to `dbo.Users.Email`; `IsActive` and the authoritative Customer/Staff/Admin role always come from SQL Server. Unknown users are not automatically created, and provider role metadata is ignored.

The frontend should use Auth0 Authorization Code with PKCE, keep access tokens in memory rather than local storage, send them only in the `Authorization: Bearer ...` header, and use Auth0's logout/end-session operation. Logout clears the browser/provider session and the frontend token; a previously issued stateless access token remains valid only until its configured short expiry. The API has no password or refresh-token endpoint and therefore no brute-forceable local login surface; MFA, credential recovery, rate limiting, and session controls remain Auth0's responsibility. Access-token lifetime is configured at the provider and enforced through the token `exp` claim.

`GET /api/session` deterministically returns either `{ authenticated: false, user: null }` or safe SQL-backed user fields. It never returns raw tokens, provider metadata, secrets, or credentials. Because authentication uses a non-cookie bearer token, CSRF tokens are not required. Browser CORS is restricted to the exact `FRONTEND_ORIGIN`; wildcard credentialed access is not used.

## Environment

Server-only:

- `AUTH_ISSUER` — exact expected token issuer
- `AUTH_AUDIENCE` — exact API audience
- `AUTH_JWKS_URL` — HTTPS JWKS endpoint

Non-secret server configuration:

- `FRONTEND_ORIGIN` — exact allowed Web/PWA origin

Local development only:

- `ENABLE_DEV_AUTH=true`
- `DEV_AUTH_EMAIL`
- optional `x-dev-user` header

Development authentication throws a configuration error in production and never falls back to a demo identity. Production protected endpoints fail closed when credentials are absent, invalid, expired, or misconfigured.

Microsoft Entra / NU SSO can later replace the authentication provider by changing OIDC configuration, or by implementing the small `AuthProvider` interface, without rewriting Bulldogs Xchange business services or authorization rules.
