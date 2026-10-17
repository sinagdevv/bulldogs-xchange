import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const sql=readFileSync("supabase/migrations/20261017110000_operator_invitation_email_hook.sql","utf8");
const allowed=(email:string,entry:{email:string;expiresAt:number;revokedAt?:number}|undefined,now=1000)=>Boolean(entry&&entry.email===email.trim().toLowerCase()&&entry.expiresAt>now&&!entry.revokedAt);

describe("operator invitation email hook migration",()=>{
  it.each([["allowed",{email:"cacanantajrp@students.nu-fairview.edu.ph",expiresAt:1001},true],["unknown",undefined,false],["expired",{email:"cacanantajrp@students.nu-fairview.edu.ph",expiresAt:1000},false],["revoked",{email:"cacanantajrp@students.nu-fairview.edu.ph",expiresAt:1001,revokedAt:1000},false]] as const)("fails closed for %s",(_,entry,expected)=>expect(allowed(" CACANANTAJRP@students.nu-fairview.edu.ph ",entry)).toBe(expected));
  it("rejects duplicate email entries with the primary key",()=>expect(sql).toContain("invitation_email text PRIMARY KEY"));
  it("uses normalized exact EDU email, short expiry, revocation, audit fields, and no public write grant",()=>{expect(sql).toContain("invitation_email=lower(btrim(invitation_email))");expect(sql).toContain("@students\\.nu-fairview\\.edu\\.ph");expect(sql).toContain("interval '15 minutes'");expect(sql).toContain("expires_at>now() AND revoked_at IS NULL");expect(sql).toContain("authorized_by");expect(sql).toContain("authorization_reference");expect(sql).toContain("REVOKE ALL ON public.operator_invitation_email_allowlist FROM PUBLIC, anon, authenticated");});
  it("preserves private alias handling and keeps every other identity blocked",()=>{expect(sql).toContain("operator_alias_provisioning_allowlist");expect(sql).toContain("alias_email=requested_email AND expires_at>now()");expect(sql).toContain("Account provisioning is operator-only." );expect(sql).not.toContain("RoleId");expect(sql).not.toContain("email_confirm" );});
});
