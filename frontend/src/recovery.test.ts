import {afterEach,describe,expect,it,vi} from "vitest";
import {RECOVERY_PATH,recoveryAccessToken,recoveryLanding} from "./recovery-token";
describe("password recovery callback",()=>{
  it("accepts only the provider recovery callback token",()=>{expect(recoveryAccessToken("#access_token=secret-token&type=recovery&expires_in=3600")).toBe("secret-token");expect(recoveryAccessToken("#access_token=secret-token&type=signup")).toBeNull()});
  it("rejects missing and malformed callback state",()=>{expect(recoveryAccessToken("")).toBeNull();expect(recoveryAccessToken("#type=recovery")).toBeNull();expect(recoveryAccessToken("#access_token=x")).toBeNull()});
});
describe("recovery landing decision",()=>{
  it("stays on /auth/recovery when Supabase's redirect_to was honored",()=>{expect(recoveryLanding(RECOVERY_PATH,"#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH})});
  it("redirects to /auth/recovery when the redirect allowlist mismatch strands the token on another path (e.g. the homepage)",()=>{expect(recoveryLanding("/","#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH});expect(recoveryLanding("/shop","#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH})});
  it("ignores a hash with no recovery token on any path",()=>{expect(recoveryLanding("/","")).toBeNull();expect(recoveryLanding("/","#access_token=secret-token&type=signup")).toBeNull();expect(recoveryLanding(RECOVERY_PATH,"")).toBeNull()});
});
describe("recovery token capture at module load",()=>{
  const load=async(pathname:string,hash:string,search="")=>{vi.resetModules();const replaceState=vi.fn();vi.stubGlobal("window",{location:{pathname,hash,search},history:{replaceState}});const mod=await import("./recovery-token");return{token:mod.capturedRecoveryToken,replaceState}};
  afterEach(()=>vi.unstubAllGlobals());
  it("captures a token stranded on the homepage, moves to /auth/recovery and scrubs the fragment",async()=>{const{token,replaceState}=await load("/","#access_token=secret-token&type=recovery&refresh_token=r");expect(token).toBe("secret-token");expect(replaceState).toHaveBeenCalledOnce();const url=String(replaceState.mock.calls[0]?.[2]);expect(url).toBe("/auth/recovery");expect(url).not.toContain("secret-token")});
  it("keeps the query string and scrubs the fragment when already on /auth/recovery",async()=>{const{token,replaceState}=await load("/auth/recovery","#access_token=secret-token&type=recovery","?x=1");expect(token).toBe("secret-token");expect(replaceState.mock.calls[0]?.[2]).toBe("/auth/recovery?x=1")});
  it("leaves non-recovery URLs untouched",async()=>{const{token,replaceState}=await load("/shop","#access_token=a&type=signup");expect(token).toBeNull();expect(replaceState).not.toHaveBeenCalled()});
  it("never writes the token to web storage",async()=>{const set=vi.fn();vi.stubGlobal("localStorage",{setItem:set});vi.stubGlobal("sessionStorage",{setItem:set});await load("/","#access_token=secret-token&type=recovery");expect(set).not.toHaveBeenCalled()});
});
