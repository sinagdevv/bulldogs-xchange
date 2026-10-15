export const RECOVERY_PATH="/auth/recovery";

/** Returns the access token only from a provider password-recovery callback hash. */
export function recoveryAccessToken(hash:string){const params=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash);return params.get("type")==="recovery"?params.get("access_token"):null;}

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
