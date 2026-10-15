# Phase 10 activation readiness

Verified demo targets: Supabase `qyzwruvggwxbmqrurmxh`; Vercel `prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf`. The repository must remain unlinked from Supabase and every remote database command must name the demo ref explicitly.

## Current hold

Supabase email/password, email confirmation, the institutional-domain Before User Created hook, production Site URL, recovery redirects, and disabled signup/anonymous access are verified. Custom SMTP is not configured. Do not create the four live accounts or enable registration until an approved SMTP provider passes confirmation and recovery delivery checks.

The existing Vercel database URL is the catalog-only role. Authenticated workflows require the separate `SUPABASE_APPLICATION_DATABASE_URL`; the server prefers it when present and retains the catalog URL as the bootstrap fallback. Never expose either connection through `VITE_*`.

## Reviewed application role

`database/postgres/005_application_runtime_role.sql` creates `bulldogs_app_runtime` with explicit `dbo` table privileges, sequence use, and no DELETE, DDL, `auth`, `vault`, superuser, BYPASSRLS, role creation, or database creation. API authentication, approval status, and role checks remain the authorization boundary. The script requires a password supplied interactively as the psql variable `runtime_password`; never save or print it.

## Approval sequence

1. Approve custom SMTP configuration and perform one confirmation plus one recovery delivery test.
2. Approve remote creation of `bulldogs_app_runtime` on the demo project only, followed by read/write/denial probes.
3. Approve server-only Vercel Auth, Upstash, and application-database variables. Keep `ENABLE_INSTITUTIONAL_EMAIL_REGISTRATION=false` and Power Automate dispatch disabled.
4. Approve a deployment, then verify registration still fails closed before enabling it.
5. Separately approve registration activation and inbox-owned signup for the four named institutional addresses.
6. After confirmed identities exist, separately approve exact Admin bootstrap, Customer approvals, and Staff promotion. Student and Teacher remain Customers.

No account, role, provider configuration, environment, or deployment change is authorized by this document.
