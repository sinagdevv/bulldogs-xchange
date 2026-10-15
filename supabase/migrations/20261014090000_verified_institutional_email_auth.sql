-- Allow only real institutional addresses through Supabase's supported signup flow.
-- Supabase Confirm email must remain enabled; application approval remains database-authoritative.
CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requested_email text := lower(trim(event->'user'->>'email'));
BEGIN
  IF requested_email ~ '^[^@[:space:]]+@(students\.)?nu-fairview\.edu\.ph$' THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use an approved NU Fairview institutional email.'));
END; $$;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;
