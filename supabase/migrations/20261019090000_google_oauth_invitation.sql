-- Google OAuth: non-institutional email invitation allowlist + corrected signup hook
-- Must be applied AFTER Google OAuth application code is deployed.
BEGIN;

ALTER TABLE dbo.Users ALTER COLUMN SchoolId DROP NOT NULL;

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

CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  requested_email    text := lower(btrim(event->'user'->>'email'));
  requested_provider text := lower(btrim(event->'user'->'app_metadata'->>'provider'));
BEGIN
  IF session_user = 'supabase_auth_admin'
     AND requested_provider IN ('email','google')
     AND (
       EXISTS (SELECT 1 FROM public.operator_alias_provisioning_allowlist WHERE alias_email=requested_email AND expires_at>now())
       OR EXISTS (SELECT 1 FROM public.operator_invitation_email_allowlist WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.operator_invitation_attempts WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
       OR EXISTS (SELECT 1 FROM public.operator_google_oauth_allowlist WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
     ) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Account provisioning is operator-only.'));
END; $$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;

COMMIT;
-- Rollback: re-apply 20261017130000_operator_invitation_retry_attempts.sql hook block,
-- then DROP TABLE IF EXISTS public.operator_google_oauth_allowlist (if empty).
-- SchoolId SET NOT NULL only if zero NULL rows exist in dbo.Users.
