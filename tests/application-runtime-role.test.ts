import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("application runtime role",()=>{
  const sql=readFileSync("database/postgres/005_application_runtime_role.sql","utf8");
  it("is non-privileged and cannot create or delete",()=>{
    expect(sql).toContain("NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    expect(sql).toContain("REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER");
    expect(sql).toContain("REVOKE CREATE ON SCHEMA dbo, public");
  });
  it("cannot access provider administration schemas",()=>{
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA auth, vault");
    expect(sql).not.toMatch(/GRANT\s+[^;]+\s+ON\s+[^;]*(?:auth|vault)\./i);
  });
  it("grants only the application DML needed by reviewed services",()=>{
    expect(sql).toContain("GRANT SELECT ON TABLE");
    expect(sql).toContain("GRANT INSERT ON TABLE");
    expect(sql).toContain("GRANT UPDATE ON TABLE");
    expect(sql).toContain("dbo.automationoutbox");
    expect(sql).toContain("dbo.approvalhistory");
    expect(sql).not.toMatch(/GRANT\s+ALL/i);
  });
});
