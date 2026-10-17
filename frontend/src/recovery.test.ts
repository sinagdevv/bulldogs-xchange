import {afterEach,describe,expect,it,vi} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {INVITATION_PATH,RECOVERY_PATH,inviteLanding,recoveryAccessToken,recoveryLanding,recoveryTokenHash} from "./recovery-token";
describe("password recovery callback",()=>{
  it("accepts only the provider recovery callback token",()=>{expect(recoveryAccessToken("#access_token=secret-token&type=recovery&expires_in=3600")).toBe("secret-token");expect(recoveryAccessToken("#access_token=secret-token&type=signup")).toBeNull()});
  it("accepts a recovery token hash only with the recovery type",()=>{expect(recoveryTokenHash("#token_hash=hashed-token&type=recovery")).toBe("hashed-token");expect(recoveryTokenHash("#token_hash=hashed-token&type=invite")).toBeNull()});
  it("rejects missing and malformed callback state",()=>{expect(recoveryAccessToken("")).toBeNull();expect(recoveryAccessToken("#type=recovery")).toBeNull();expect(recoveryAccessToken("#access_token=x")).toBeNull()});
});
describe("recovery landing decision",()=>{
  it("stays on /auth/recovery when Supabase's redirect_to was honored",()=>{expect(recoveryLanding(RECOVERY_PATH,"#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH})});
  it("redirects to /auth/recovery when the redirect allowlist mismatch strands the token on another path (e.g. the homepage)",()=>{expect(recoveryLanding("/","#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH});expect(recoveryLanding("/shop","#access_token=secret-token&type=recovery")).toEqual({token:"secret-token",path:RECOVERY_PATH})});
  it("ignores a hash with no recovery token on any path",()=>{expect(recoveryLanding("/","")).toBeNull();expect(recoveryLanding("/","#access_token=secret-token&type=signup")).toBeNull();expect(recoveryLanding(RECOVERY_PATH,"")).toBeNull()});
});
describe("invitation landing decision",()=>{
  it("accepts an invite token stranded on the homepage",()=>expect(inviteLanding("/","#access_token=secret-token&type=invite","")).toEqual({token:"secret-token",path:INVITATION_PATH,invalid:false}));
  it("routes expired or consumed links to a safe generic state",()=>expect(inviteLanding("/","","?error=access_denied&error_code=otp_expired")).toEqual({token:null,path:INVITATION_PATH,invalid:true}));
  it("ignores non-invitation callbacks",()=>expect(inviteLanding("/","#access_token=secret-token&type=recovery","")).toBeNull());
});
describe("recovery token capture at module load",()=>{
  const load=async(pathname:string,hash:string,search="")=>{vi.resetModules();const replaceState=vi.fn();vi.stubGlobal("window",{location:{pathname,hash,search},history:{replaceState}});const mod=await import("./recovery-token");return{token:mod.capturedRecoveryToken,tokenHash:mod.capturedRecoveryTokenHash,inviteToken:mod.capturedInviteToken,replaceState}};
  afterEach(()=>vi.unstubAllGlobals());
  it("captures a token stranded on the homepage, moves to /auth/recovery and scrubs the fragment",async()=>{const{token,replaceState}=await load("/","#access_token=secret-token&type=recovery&refresh_token=r");expect(token).toBe("secret-token");expect(replaceState).toHaveBeenCalledOnce();const url=String(replaceState.mock.calls[0]?.[2]);expect(url).toBe("/auth/recovery");expect(url).not.toContain("secret-token")});
  it("keeps the query string and scrubs the fragment when already on /auth/recovery",async()=>{const{token,replaceState}=await load("/auth/recovery","#access_token=secret-token&type=recovery","?x=1");expect(token).toBe("secret-token");expect(replaceState.mock.calls[0]?.[2]).toBe("/auth/recovery?x=1")});
  it("captures an invitation token and routes it to the password setup screen",async()=>{const{inviteToken,replaceState}=await load("/","#access_token=secret-token&type=invite");expect(inviteToken).toBe("secret-token");expect(replaceState.mock.calls[0]?.[2]).toBe("/auth/invite")});
  it("captures a template token hash without consuming it and renders confirmation",async()=>{vi.resetModules();const replaceState=vi.fn(),fetcher=vi.fn();vi.stubGlobal("window",{location:{pathname:"/auth/recovery",hash:"#token_hash=hashed-token&type=recovery",search:""},history:{replaceState}});vi.stubGlobal("fetch",fetcher);const token=await import("./recovery-token"),page=await import("./recovery");expect(token.capturedRecoveryTokenHash).toBe("hashed-token");expect(replaceState.mock.calls[0]?.[2]).toBe("/auth/recovery");expect(fetcher).not.toHaveBeenCalled();expect(renderToStaticMarkup(createElement(page.PasswordRecovery))).toContain("Continue to reset password")});
  it("leaves non-recovery URLs untouched",async()=>{const{token,replaceState}=await load("/shop","#access_token=a&type=signup");expect(token).toBeNull();expect(replaceState).not.toHaveBeenCalled()});
  it("never writes the token to web storage",async()=>{const set=vi.fn();vi.stubGlobal("localStorage",{setItem:set});vi.stubGlobal("sessionStorage",{setItem:set});await load("/","#access_token=secret-token&type=recovery");expect(set).not.toHaveBeenCalled()});
});
