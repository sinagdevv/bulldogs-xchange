import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("Google OAuth release SQL",()=>{
  it("is review-only and permits only email and Google Auth creation",()=>{const sql=readFileSync("docs/google-oauth-pending-registration.sql","utf8");expect(sql).toContain("REVIEW-ONLY");expect(sql).toContain("SchoolId DROP NOT NULL");expect(sql).toContain("requested_provider IN ('email','google')");expect(sql).toContain("session_user='supabase_auth_admin'");expect(sql).toContain("operator_invitation_attempts");expect(sql).toContain("REVOKE EXECUTE");expect(sql).not.toMatch(/INSERT\s+INTO\s+dbo\.Users|UPDATE\s+dbo\.Users|DELETE\s+FROM\s+dbo\.Users/i);});

  it("RLS migration is idempotent and adds insert+update policies for bulldogs_app_runtime",()=>{
    const sql=readFileSync("supabase/migrations/20261019120000_google_oauth_allowlist_rls.sql","utf8");
    expect(sql).toContain("CREATE POLICY");
    expect(sql).toContain("runtime_insert_google_invitation");
    expect(sql).toContain("runtime_update_google_invitation");
    expect(sql).toContain("bulldogs_app_runtime");
    expect(sql).toContain("GRANT UPDATE(authorized_by");
    expect(sql).toContain("GRANT SELECT(invitation_email)");
    expect(sql).not.toContain("BYPASSRLS");
    expect(sql).not.toContain("DISABLE ROW LEVEL SECURITY");
    expect(sql).not.toContain("anon");
    expect(sql).not.toContain("authenticated");
    expect(sql).not.toMatch(/GRANT\s+ALL/i);
  });
});
