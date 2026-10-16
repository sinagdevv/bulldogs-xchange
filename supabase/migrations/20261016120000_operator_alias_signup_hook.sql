-- REVIEW ONLY: do not apply until separately authorized.
-- Restores service-role/operator alias creation while public signup remains blocked.
CREATE TABLE IF NOT EXISTS public.operator_alias_provisioning_allowlist(
  alias_email text PRIMARY KEY CHECK (alias_email ~ '^[0-9a-f]{64}@auth\.bulldogs-xchange\.invalid$'),
  expires_at timestamptz NOT NULL
);
REVOKE ALL ON public.operator_alias_provisioning_allowlist FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requested_email text := lower(trim(event->'user'->>'email'));
BEGIN
  IF current_user='supabase_auth_admin' AND EXISTS (
    SELECT 1 FROM public.operator_alias_provisioning_allowlist
    WHERE alias_email=requested_email AND expires_at>now()
  ) THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account provisioning is operator-only.'));
END; $$;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;

-- Rollback: re-apply 20261014090000_verified_institutional_email_auth.sql, then DROP TABLE public.operator_alias_provisioning_allowlist.
