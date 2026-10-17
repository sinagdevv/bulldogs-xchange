-- REVIEW ONLY: do not apply until separately authorized.
-- SECURITY DEFINER changes current_user to the function owner; use the Auth caller identity instead.
CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requested_email text := lower(btrim(event->'user'->>'email'));
BEGIN
  IF session_user='supabase_auth_admin' AND (
    EXISTS (SELECT 1 FROM public.operator_alias_provisioning_allowlist WHERE alias_email=requested_email AND expires_at>now())
    OR EXISTS (SELECT 1 FROM public.operator_invitation_email_allowlist WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
  ) THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account provisioning is operator-only.'));
END; $$;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;
