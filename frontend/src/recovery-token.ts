export const RECOVERY_PATH="/auth/recovery";
export const INVITATION_PATH="/auth/invite";

/** Returns the access token only from a provider password-recovery callback hash. */
export function recoveryAccessToken(hash:string){const params=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash);return params.get("type")==="recovery"?params.get("access_token"):null;}
export function recoveryTokenHash(hash:string){const params=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash);return params.get("type")==="recovery"?params.get("token_hash"):null;}

/**
 * Pure decision for where a landing location should go once Supabase's /verify redirect lands.
 * Supabase's GoTrue only honors a custom redirect_to when it exactly matches (or matches a
 * wildcard pattern within) the project's Redirect URLs allowlist; when it does not match — for
 * example when only the bare origin is allowlisted and not the /auth/recovery path — GoTrue
 * silently falls back to the project's Site URL and appends the identical
 * #access_token=...&type=recovery fragment there instead. Recognizing the fragment on any path,
 * not only /auth/recovery, keeps a Supabase Dashboard misconfiguration from stranding the token
 * on the homepage. Exported pure (no DOM access) so it is unit-testable without a browser
 * environment.
 */
export function recoveryLanding(pathname:string,hash:string):{token:string;path:string}|null{
  const token=recoveryAccessToken(hash);
  if(!token)return null;
  return {token,path:pathname===RECOVERY_PATH?pathname:RECOVERY_PATH};
}

/** Handles successful and rejected provider invite callbacks without retaining provider details. */
export function inviteLanding(pathname:string,hash:string,search:string):{token:string|null;path:string;invalid:boolean}|null{
  const params=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash),token=params.get("type")==="invite"?params.get("access_token"):null;
  if(token)return {token,path:pathname===INVITATION_PATH?pathname:INVITATION_PATH,invalid:false};
  const query=new URLSearchParams(search.startsWith("?")?search.slice(1):search);
  return query.get("error_code")==="otp_expired"?{token:null,path:INVITATION_PATH,invalid:true}:null;
}

/**
 * Captured once, at module load, from whichever location Supabase's /verify redirect actually
 * landed on (see recoveryLanding above for why that may not be /auth/recovery). The token is
 * scrubbed from the visible URL and from browser history immediately, before it is read again
 * or lingers anywhere. Held only in memory for the lifetime of this module — never logged,
 * stored, or persisted. No-ops outside a browser (SSR/tests).
 */
export const capturedRecoveryToken:string|null=(()=>{
  if(typeof window==="undefined")return null;
  const landing=recoveryLanding(window.location.pathname,window.location.hash);
  if(!landing)return null;
  const search=landing.path===window.location.pathname?window.location.search:"";
  window.history.replaceState(null,"",`${landing.path}${search}`);
  return landing.token;
})();

/** A template-supplied hash is inert until the user explicitly confirms the reset. */
export const capturedRecoveryTokenHash:string|null=(()=>{
  if(typeof window==="undefined")return null;
  const tokenHash=recoveryTokenHash(window.location.hash);
  if(!tokenHash)return null;
  window.history.replaceState(null,"",RECOVERY_PATH);
  return tokenHash;
})();

const capturedInvite=(()=>{
  if(typeof window==="undefined")return null;
  const landing=inviteLanding(window.location.pathname,window.location.hash,window.location.search);
  if(!landing)return null;
  window.history.replaceState(null,"",`${landing.path}${landing.invalid?"?error=link":""}`);
  return landing;
})();
export const capturedInviteToken=capturedInvite?.token??null;
