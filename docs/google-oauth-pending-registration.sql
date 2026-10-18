-- REVIEW-ONLY RELEASE SQL. Do not apply without separate approval.
-- Prerequisite: Google OAuth application code must be deployed before this SQL is applied.
-- Approved Supabase project: qyzwruvggwxbmqrurmxh

BEGIN;

-- 1. Allow Google-only users to have a NULL SchoolId
ALTER TABLE dbo.Users ALTER COLUMN SchoolId DROP NOT NULL;

-- 2. New table for non-institutional email Google OAuth invitations.
--    Existing allowlists (operator_invitation_email_allowlist, operator_invitation_attempts)
--    are restricted to @students.nu-fairview.edu.ph and cannot hold Gmail addresses.
CREATE TABLE IF NOT EXISTS public.operator_google_oauth_allowlist(
  invitation_email text PRIMARY KEY CHECK (
    invitation_email = lower(btrim(invitation_email))
    AND invitation_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  ),
  authorized_by text NOT NULL CHECK (length(btrim(authorized_by)) BETWEEN 3 AND 200),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) BETWEEN 8 AND 200),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > authorized_at AND expires_at <= authorized_at + interval '30 days'),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR
    (revoked_at >= authorized_at AND length(btrim(revoked_by)) BETWEEN 3 AND 200 AND length(btrim(revoke_reason)) BETWEEN 3 AND 500)
  )
);
REVOKE ALL ON public.operator_google_oauth_allowlist FROM PUBLIC, anon, authenticated;
GRANT SELECT(invitation_email, expires_at, revoked_at) ON public.operator_google_oauth_allowlist TO supabase_auth_admin;
GRANT INSERT(invitation_email, authorized_by, authorization_reference, expires_at),
      UPDATE(revoked_at, revoked_by, revoke_reason) ON public.operator_google_oauth_allowlist TO bulldogs_app_runtime;

-- 3. Corrected hook: provider check is AND-combined with allowlists, not OR-combined.
--    BUG FIXED: previous version used OR which made all allowlist checks dead code,
--    allowing unrestricted signup from any email/google account.
CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  requested_email    text := lower(btrim(event->'user'->>'email'));
  requested_provider text := lower(btrim(event->'user'->'app_metadata'->>'provider'));
BEGIN
  IF session_user = 'supabase_auth_admin'
     AND requested_provider IN ('email','google')
     AND (
       EXISTS (SELECT 1 FROM public.operator_alias_provisioning_allowlist
               WHERE alias_email = requested_email AND expires_at > now())
       OR EXISTS (SELECT 1 FROM public.operator_invitation_email_allowlist
                  WHERE invitation_email = requested_email AND expires_at > now() AND revoked_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.operator_invitation_attempts
                  WHERE invitation_email = requested_email AND expires_at > now() AND revoked_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.operator_google_oauth_allowlist
                  WHERE invitation_email = requested_email AND expires_at > now() AND revoked_at IS NULL)
     ) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Account provisioning is operator-only.'
  ));
END; $$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;

COMMIT;

-- ============================================================================
-- ROLLBACK (run in Supabase SQL Editor if activation must be reversed)
-- ============================================================================
-- BEGIN;
-- -- Restore previous hook (from 20261017130000_operator_invitation_retry_attempts.sql)
-- CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
-- RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
-- DECLARE requested_email text := lower(btrim(event->'user'->>'email'));
-- BEGIN
--   IF session_user='supabase_auth_admin' AND (
--     EXISTS (SELECT 1 FROM public.operator_alias_provisioning_allowlist WHERE alias_email=requested_email AND expires_at>now())
--     OR EXISTS (SELECT 1 FROM public.operator_invitation_email_allowlist WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
--     OR EXISTS (SELECT 1 FROM public.operator_invitation_attempts WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
--   ) THEN RETURN '{}'::jsonb; END IF;
--   RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account provisioning is operator-only.'));
-- END; $$;
-- GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
-- REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;
-- -- Drop new table only if empty:
-- -- DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.operator_google_oauth_allowlist) THEN DROP TABLE public.operator_google_oauth_allowlist; END IF; END $$;
-- -- Restore SchoolId NOT NULL only if no NULL rows exist:
-- -- ALTER TABLE dbo.Users ALTER COLUMN SchoolId SET NOT NULL;
-- COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION (read-only, run after COMMIT)
-- ============================================================================
-- SELECT
--   (SELECT is_nullable FROM information_schema.columns
--    WHERE table_schema='dbo' AND table_name='users' AND column_name='schoolid') AS schoolid_nullable,
--   to_regclass('public.operator_google_oauth_allowlist') IS NOT NULL AS google_allowlist_exists,
--   (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND p.proname='hook_restrict_bulldogs_signup')
--    LIKE '%operator_google_oauth_allowlist%' AS hook_checks_google_allowlist,
--   (SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND p.proname='hook_restrict_bulldogs_signup')
--    LIKE '%AND requested_provider IN%' AS hook_provider_is_and_gate;
-- Expected: YES / t / t / t
