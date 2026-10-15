# Institutional email authentication and approval

Bulldogs Xchange accepts only verified NU Fairview institutional email addresses:

`Institutional email + password → Vercel API → Supabase signup + verification email → verified JWT → SQL approval + role authorization`

The accepted domains are `students.nu-fairview.edu.ph` and `nu-fairview.edu.ph`. Domain eligibility never grants a role. The hosted demo's four identities all use the student domain; Staff/Admin assignment still requires explicit SQL approval. The browser never receives the private alias or service-role key. Passwords pass through the TLS-protected API only to Supabase Auth and are never stored or logged by the application. New registrations are always `Customer` / `pending`; every protected request reloads the user's approval and role from SQL, so rejection or suspension takes effect without waiting for the JWT to expire.

## Required deployment actions

1. Review and explicitly approve `supabase/migrations/20261014090000_verified_institutional_email_auth.sql`; do not apply it to the protected project.
2. Set `SUPABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the server environment. The secret key is used only for compensating cleanup if the SQL transaction fails. Never expose it as a `VITE_` variable.
3. In Supabase Authentication, enable email/password sign-in and **Confirm email**. Configure the Site URL and redirect allowlist for the exact hosted-demo HTTPS origin.
4. Keep the **Before User Created** hook configured as `public.hook_restrict_bulldogs_signup`; the new migration permits only the two reviewed institutional domains.
5. Verify existing Staff/Admin rows were migrated to `approved`. Existing Customer rows intentionally become `pending` and must be reviewed rather than silently approved.
6. Set `ENABLE_INSTITUTIONAL_EMAIL_REGISTRATION=true` only after the institutional-email migration and post-migration checks pass. It defaults to disabled; login is unaffected.

## Initial Admin bootstrap

Run this local CLI before the approval migration when no active Admin exists. It uses the server-side service-role credential only to verify one immutable Supabase Auth UUID; it never changes Auth data.

```powershell
npm run auth:bootstrap-admin -- --project-ref=qyzwruvggwxbmqrurmxh --user-id=30 --auth-user-id=<AUTH_UUID> --email=<TARGET_EMAIL> --school-id=<STUDENT_ID> --confirm="PROMOTE <TARGET_EMAIL> TO INITIAL BULLDOGS XCHANGE ADMIN"
```

The command rejects a different project/database, Auth UUID or email, SQL user ID or Student ID, inactive/non-Customer target, incorrect confirmation, and any existing active Admin. Remove the service-role credential from the operator environment after use if it is not otherwise required there.

Authentication endpoints use an atomic shared Upstash Redis counter in production. Configure `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and a dedicated `AUTH_RATE_LIMIT_SECRET`; without shared-store credentials production login and registration fail closed with 503. Local development uses an in-memory store. Account and Vercel-provided client-IP identifiers are HMAC-hashed before storage; the API returns the same throttling response regardless of account existence.

`POST /api/auth/resend-verification` and `POST /api/auth/recovery` use the same limiter and return generic accepted responses. `PUT /api/auth/password` requires a valid Supabase recovery access token. Password changes never alter SQL approval or roles, and protected APIs independently require `email_confirmed_at` from Supabase.

Password recovery redirects to the exact `FRONTEND_ORIGIN` plus `/auth/recovery`. The frontend consumes Supabase's `type=recovery` fragment once, immediately removes it from browser history, validates the OTP-authenticated session through `POST /api/auth/recovery-session`, and renders the password form only after validation. A successful password update globally revokes the recovery session.

CAPTCHA is intentionally disabled for the four-account hosted demo. The institutional-domain hook, application HMAC rate limiter, generic recovery/resend responses, Supabase Auth limits, pending Admin approval, and custom SMTP quota provide proportionate protection. Reassess before broader enrollment or public promotion; enabling CAPTCHA requires a reviewed frontend challenge and server-forwarded provider token first.

Legacy `@auth.bulldogs-xchange.invalid` identities are rejected by the hosted login flow. If any real users were created under the previous alias design, migrate them only through a separately reviewed operator procedure; do not silently relink identities.
