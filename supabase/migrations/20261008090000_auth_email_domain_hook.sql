-- Configure this function as Authentication > Hooks > Before User Created.
-- Students may self-register; non-student Staff/Admin must already be explicitly approved in dbo.users.
CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_email text := lower(trim(event->'user'->>'email'));
BEGIN
  IF requested_email ~ '^[^@]+@students\.nu-fairview\.edu\.ph$' THEN
    RETURN '{}'::jsonb;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM dbo.users u
    JOIN dbo.roles r ON r.roleid=u.roleid
    WHERE lower(u.email)=requested_email AND u.isactive AND r.rolename IN ('Staff','Admin')
  ) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use an approved NU Fairview identity.'));
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;
