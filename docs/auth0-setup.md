# Auth0 setup

The API already accepts OIDC bearer access tokens. This guide configures Auth0 to issue tokens matching that contract; it does not replace the existing authentication code.

## 1. Create or select a tenant

1. Sign in to the Auth0 Dashboard and create a tenant if needed.
2. Record the tenant **Domain** shown by Auth0, for example `your-tenant.region.auth0.com`. Do not copy an example value into deployment settings.
3. Use the same Auth0 domain for authorization and for the backend issuer/JWKS settings. Mixing the Auth0 tenant domain and a custom domain produces a different `iss` claim.

## 2. Create the API

1. Open **Applications > APIs** and select **Create API**.
2. Set **Name** to `Bulldogs Xchange API`.
3. Choose a permanent **Identifier**. `https://api.bulldogs-xchange.local` is an example only; the identifier is an audience string and does not need to resolve on the internet.
4. Set **Signing Algorithm** to `RS256` and create the API.
5. Keep the identifier stable. Its exact, case-sensitive value is both the frontend audience and backend `AUTH_AUDIENCE`.

The frontend must request this audience. Without it, Auth0 may issue an opaque token or a token for another audience, and this API will return `401`.

## 3. Put verified identity claims in the access token

The current backend requires top-level `sub`, `email`, and `email_verified: true` claims in the **access token**. Auth0 custom-API access tokens do not reliably contain the two email claims by default, so configure a Post Login Action:

1. Open **Actions > Library**, select **Build Custom**, name it `Add verified email to Bulldogs Xchange access token`, and choose the **Login / Post Login** trigger.
2. Use this Action code and deploy it:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     api.accessToken.setCustomClaim("email", event.user.email);
     api.accessToken.setCustomClaim("email_verified", event.user.email_verified === true);
   };
   ```

3. Open **Actions > Triggers > post-login**, add the deployed Action to the flow, and apply the flow.
4. During validation, decode a test access token locally and confirm the three required claims are present. Never paste a live token into documentation, source control, logs, or third-party token viewers.

The flow must use Auth0 Universal Login/Authorization Code with PKCE. If Auth0 refuses a non-namespaced email claim for the selected connection or flow, stop: the backend contract must then be deliberately updated and tested to read a namespaced claim. Do not silently substitute a different claim.

## 4. Create the SPA application

1. Open **Applications > Applications** and select **Create Application**.
2. Set **Name** to `Bulldogs Xchange Web`.
3. Select **Single Page Web Applications** and create it.
4. In **Settings**, record the **Domain** and **Client ID**. A SPA is public: do not use or expose a Client Secret.
5. Under **Advanced Settings > Grant Types**, keep **Authorization Code** enabled. The future frontend must use Authorization Code with PKCE (`response_type=code`, `code_challenge_method=S256`) through the Auth0 SPA SDK.
6. Enable the intended Auth0 connection for this application. Auth0 user emails must be verified before the backend will accept them.

## 5. Configure browser URLs

No frontend or frontend port exists in this repository yet. In the application Settings page, leave these as **TO BE FINALIZED WHEN FRONTEND IS CREATED** rather than guessing a port:

- **Allowed Callback URLs**: `http://localhost:<frontend-port>/<callback-path>`
- **Allowed Logout URLs**: `http://localhost:<frontend-port>`
- **Allowed Web Origins**: `http://localhost:<frontend-port>`

When the frontend is deployed, add its exact Vercel production values, for example `https://<frontend-project>.vercel.app/<callback-path>` for callbacks and the origin without a path for logout/web origins. Also add any stable custom production domain. Avoid wildcards; scheme, host, port, path, and trailing slash must match what the frontend sends.

## 6. Backend environment format

Set these in the backend deployment environment, not in tracked files:

```text
AUTH_ISSUER=https://<auth0-domain>/
AUTH_AUDIENCE=<exact API Identifier>
AUTH_JWKS_URL=https://<auth0-domain>/.well-known/jwks.json
FRONTEND_ORIGIN=https://<exact frontend host>
```

- `AUTH_ISSUER` is matched exactly by `jose`. Auth0's `iss` claim has a trailing `/`, so include it.
- `AUTH_AUDIENCE` must exactly match the API Identifier created above.
- `AUTH_JWKS_URL` must be HTTPS; production code rejects any other scheme. Use the tenant/custom domain that issues the token and the exact `/.well-known/jwks.json` path.
- `FRONTEND_ORIGIN` is one exact origin: scheme + host + optional port, with no path and normally no trailing slash. Requests with a different browser `Origin` receive `403`.

Also set the existing server-only SQL and operational variables listed in `.env.example`. Set `NODE_ENV=production`, `DATA_PROVIDER=sqlserver`, and keep `ENABLE_DEV_AUTH=false`.

## 7. Frontend configuration contract

The future Web/PWA needs four public values. Names can be adapted to its eventual build tool, but the contract is:

```text
PUBLIC_AUTH0_DOMAIN
PUBLIC_AUTH0_CLIENT_ID
PUBLIC_AUTH0_AUDIENCE
PUBLIC_AUTH0_REDIRECT_URI
```

- Domain: Auth0 domain without `https://` when required by the chosen SPA SDK.
- Client ID: the `Bulldogs Xchange Web` SPA Client ID.
- Audience: exact API Identifier / backend `AUTH_AUDIENCE`.
- Redirect URI: exact value registered in Allowed Callback URLs.

These identifiers are expected to be visible in browser code. Never expose `SQL_USER`, `SQL_PASSWORD`, `BX_AUTOMATION_SECRET`, `OUTBOX_DISPATCH_SECRET`, Auth0 Management API tokens, application Client Secrets, or any `PA_*_URL` to the frontend.

## 8. Auth0 user to SQL user mapping

Authentication alone does not provision access. The normalized, verified Auth0 email must match an active `dbo.Users.Email` row:

- no SQL row: `403 FORBIDDEN`
- inactive SQL row: `403 INACTIVE_USER`
- active row: authorization uses only the SQL role (`Customer`, `Staff`, or `Admin`)

Auth0 roles, permissions, and user metadata are ignored for Bulldogs Xchange authorization.

## 9. Vercel and SQL Server

The current local configuration uses `localhost:1433`, unencrypted transport, and a trusted local certificate. From a Vercel Function, `localhost` means that function's own runtime, not this development PC, so deployment is blocked.

Safe options are a managed, publicly routable SQL Server service with TLS and narrowly scoped credentials (for example Azure SQL), or private connectivity from an appropriate hosted backend to a private SQL Server. Do not expose the local/Express/LAN SQL Server, weaken its firewall, or disable production TLS merely to make Vercel connect. Database migration and infrastructure provisioning are outside this phase.

The existing `api/[...path].ts` catch-all and `api/health.ts` are structurally suitable for Vercel Functions and TypeScript builds without a `vercel.json`. Deployment must wait until Auth0 values exist and the SQL host is reachable securely.
