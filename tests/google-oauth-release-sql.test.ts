import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("Google OAuth release SQL",()=>{
  it("is review-only and permits only email and Google Auth creation",()=>{const sql=readFileSync("docs/google-oauth-pending-registration.sql","utf8");expect(sql).toContain("REVIEW-ONLY");expect(sql).toContain("SchoolId DROP NOT NULL");expect(sql).toContain("requested_provider IN ('email','google')");expect(sql).toContain("session_user='supabase_auth_admin'");expect(sql).toContain("operator_invitation_attempts");expect(sql).toContain("REVOKE EXECUTE");expect(sql).not.toMatch(/INSERT\s+INTO\s+dbo\.Users|UPDATE\s+dbo\.Users|DELETE\s+FROM\s+dbo\.Users/i);});
});
