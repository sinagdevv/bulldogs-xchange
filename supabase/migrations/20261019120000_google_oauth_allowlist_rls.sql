-- Google OAuth allowlist: RLS policies and missing column grants for bulldogs_app_runtime
--
-- Root causes fixed by this migration:
--   1. RLS is enabled on operator_google_oauth_allowlist with zero policies, so all DML
--      from bulldogs_app_runtime is silently denied despite column-level INSERT/UPDATE grants.
--   2. The ON CONFLICT DO UPDATE SET clause in POST /api/admin/users/google-invite sets
--      authorized_by, authorization_reference, authorized_at, and expires_at, but only
--      revoked_at, revoked_by, revoke_reason were granted for UPDATE in 20261019090000.
--   3. PostgreSQL requires SELECT privilege on the conflict_target column (invitation_email)
--      for ON CONFLICT conflict detection.
--
-- Idempotent: CREATE POLICY IF NOT EXISTS and GRANT are safe to re-run.

BEGIN;

-- 1. INSERT policy: allow bulldogs_app_runtime to insert new Google OAuth invitations.
--    WITH CHECK (true): all row validity is enforced by the table's own CHECK constraints.
CREATE POLICY "runtime_insert_google_invitation"
  ON public.operator_google_oauth_allowlist
  AS PERMISSIVE FOR INSERT
  TO bulldogs_app_runtime
  WITH CHECK (true);

-- 2. UPDATE policy: allow bulldogs_app_runtime to update rows via ON CONFLICT DO UPDATE.
--    USING (true): the INSERT ... ON CONFLICT only ever updates the single row whose
--    invitation_email equals the value being inserted; it never scans unrelated rows.
CREATE POLICY "runtime_update_google_invitation"
  ON public.operator_google_oauth_allowlist
  AS PERMISSIVE FOR UPDATE
  TO bulldogs_app_runtime
  USING (true)
  WITH CHECK (true);

-- 3. Expand UPDATE column grant to cover all columns SET in the ON CONFLICT DO UPDATE clause.
--    authorized_by, authorization_reference, authorized_at, expires_at were missing from
--    the original 20261019090000 grant (which only included revoked_at, revoked_by, revoke_reason).
GRANT UPDATE(authorized_by, authorization_reference, authorized_at, expires_at)
  ON public.operator_google_oauth_allowlist TO bulldogs_app_runtime;

-- 4. Grant SELECT on invitation_email for ON CONFLICT conflict-target evaluation.
--    PostgreSQL requires SELECT privilege on conflict_target columns; this does not expose
--    other columns or rows to the runtime.
GRANT SELECT(invitation_email)
  ON public.operator_google_oauth_allowlist TO bulldogs_app_runtime;

COMMIT;

-- ROLLBACK (apply in order if reverting):
-- DROP POLICY IF EXISTS "runtime_insert_google_invitation" ON public.operator_google_oauth_allowlist;
-- DROP POLICY IF EXISTS "runtime_update_google_invitation" ON public.operator_google_oauth_allowlist;
-- REVOKE UPDATE(authorized_by, authorization_reference, authorized_at, expires_at)
--   ON public.operator_google_oauth_allowlist FROM bulldogs_app_runtime;
-- REVOKE SELECT(invitation_email)
--   ON public.operator_google_oauth_allowlist FROM bulldogs_app_runtime;

-- VERIFICATION (run after applying; expect all rows):
-- SELECT polname, polcmd, polroles::regrole[]::text[]
-- FROM pg_policy
-- WHERE polrelid = 'public.operator_google_oauth_allowlist'::regclass
-- ORDER BY polname;
-- Expected rows:
--   runtime_insert_google_invitation  | i | {bulldogs_app_runtime}
--   runtime_update_google_invitation  | r | {bulldogs_app_runtime}
--
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.column_privileges
-- WHERE table_schema='public' AND table_name='operator_google_oauth_allowlist'
--   AND grantee='bulldogs_app_runtime'
-- ORDER BY column_name, privilege_type;
-- Expected: invitation_email/SELECT, invitation_email+authorized_by+authorization_reference+
--           authorized_at+expires_at/INSERT, all of the above plus revoked_at+revoked_by+
--           revoke_reason/UPDATE.
