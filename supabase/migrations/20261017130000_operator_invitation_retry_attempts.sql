-- REVIEW ONLY: do not apply until separately authorized.
-- Append-only attempts retain every authorization and revocation while allowing a newly authorized retry.
CREATE TABLE IF NOT EXISTS public.operator_invitation_attempts(
  attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_email text NOT NULL CHECK (invitation_email=lower(btrim(invitation_email)) AND invitation_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@students\.nu-fairview\.edu\.ph$'),
  authorized_by text NOT NULL CHECK (length(btrim(authorized_by)) BETWEEN 3 AND 200),
  authorization_reference text NOT NULL CHECK (length(btrim(authorization_reference)) BETWEEN 8 AND 200),
  authorized_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at>authorized_at AND expires_at<=authorized_at+interval '15 minutes'),
  revoked_at timestamptz,
  revoked_by text,
  revoke_reason text,
  UNIQUE(invitation_email,authorization_reference),
  CHECK ((revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR (revoked_at>=authorized_at AND length(btrim(revoked_by)) BETWEEN 3 AND 200 AND length(btrim(revoke_reason)) BETWEEN 3 AND 500))
);
REVOKE ALL ON public.operator_invitation_attempts FROM PUBLIC, anon, authenticated, bulldogs_app_runtime;
GRANT SELECT(invitation_email,expires_at,revoked_at) ON public.operator_invitation_attempts TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.stage_operator_invitation_attempt(p_email text,p_authorized_by text,p_authorization_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text:=lower(btrim(p_email)); v_attempt_id uuid;
BEGIN
  IF p_email IS NULL OR p_authorized_by IS NULL OR p_authorization_reference IS NULL OR v_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@students\.nu-fairview\.edu\.ph$' OR length(btrim(p_authorized_by)) NOT BETWEEN 3 AND 200 OR length(btrim(p_authorization_reference)) NOT BETWEEN 8 AND 200 THEN RAISE EXCEPTION 'Invalid invitation authorization.' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_email));
  IF EXISTS (SELECT 1 FROM public.operator_invitation_attempts WHERE invitation_email=v_email AND authorization_reference=btrim(p_authorization_reference)) THEN RAISE EXCEPTION 'Authorization reference was already used.' USING ERRCODE='23505'; END IF;
  IF EXISTS (SELECT 1 FROM public.operator_invitation_attempts WHERE invitation_email=v_email AND expires_at>now() AND revoked_at IS NULL) THEN RAISE EXCEPTION 'An invitation authorization is already active.' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.operator_invitation_attempts(invitation_email,authorized_by,authorization_reference,expires_at) VALUES(v_email,btrim(p_authorized_by),btrim(p_authorization_reference),now()+interval '15 minutes') RETURNING attempt_id INTO v_attempt_id;
  RETURN v_attempt_id;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_operator_invitation_attempt(p_attempt_id uuid,p_authorized_by text,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF length(btrim(p_authorized_by)) NOT BETWEEN 3 AND 200 OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Invalid invitation revocation.' USING ERRCODE='22023'; END IF;
  UPDATE public.operator_invitation_attempts SET revoked_at=now(),revoked_by=btrim(p_authorized_by),revoke_reason=btrim(p_reason) WHERE attempt_id=p_attempt_id AND revoked_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.stage_operator_invitation_attempt(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_operator_invitation_attempt(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_operator_invitation_attempt(text,text,text) TO bulldogs_app_runtime;
GRANT EXECUTE ON FUNCTION public.revoke_operator_invitation_attempt(uuid,text,text) TO bulldogs_app_runtime;

CREATE OR REPLACE FUNCTION public.hook_restrict_bulldogs_signup(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requested_email text := lower(btrim(event->'user'->>'email'));
BEGIN
  IF session_user='supabase_auth_admin' AND (
    EXISTS (SELECT 1 FROM public.operator_alias_provisioning_allowlist WHERE alias_email=requested_email AND expires_at>now())
    OR EXISTS (SELECT 1 FROM public.operator_invitation_email_allowlist WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.operator_invitation_attempts WHERE invitation_email=requested_email AND expires_at>now() AND revoked_at IS NULL)
  ) THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account provisioning is operator-only.'));
END; $$;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_restrict_bulldogs_signup(jsonb) FROM authenticated, anon, public;
