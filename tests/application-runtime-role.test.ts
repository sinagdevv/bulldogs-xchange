import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

describe("application runtime role",()=>{
  const sql=readFileSync("database/postgres/005_application_runtime_role.sql","utf8");
  const catalogMappingMigration=readFileSync("supabase/migrations/20261018000000_catalog_import_mappings.sql","utf8");
  it("is non-privileged and cannot create or delete",()=>{
    expect(sql).toContain("NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    expect(sql).toContain("REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER");
    expect(sql).toContain("REVOKE CREATE ON SCHEMA dbo, public");
  });
  it("cannot access provider administration schemas",()=>{
    expect(sql).toContain("REVOKE ALL ON SCHEMA public, auth, vault");
    expect(sql).not.toMatch(/GRANT\s+[^;]+\s+ON\s+[^;]*(?:auth|vault)\./i);
  });
  it("grants only the application DML needed by reviewed services",()=>{
    expect(sql).toContain("GRANT SELECT ON TABLE");
    expect(sql).toContain("GRANT INSERT ON TABLE");
    expect(sql).toContain("GRANT UPDATE ON TABLE");
    expect(sql).toContain("dbo.automationoutbox");
    expect(sql).toContain("dbo.approvalhistory");
    expect(sql).toContain("dbo.auth_rate_limits");
    expect(sql).toContain("dbo.bx_barky_sessions");
    expect(sql).not.toMatch(/GRANT\s+ALL/i);
  });
  it("limits catalog provenance to runtime reads and inserts",()=>{
    expect(catalogMappingMigration).toContain("REVOKE ALL ON TABLE dbo.catalogimportmappings FROM PUBLIC");
    expect(catalogMappingMigration).toContain("rolname = 'anon'");
    expect(catalogMappingMigration).toContain("rolname = 'authenticated'");
    expect(catalogMappingMigration).toContain("GRANT SELECT, INSERT ON TABLE dbo.catalogimportmappings TO bulldogs_app_runtime");
    expect(catalogMappingMigration).not.toMatch(/GRANT\s+(?:ALL|[^;]*(?:UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER))[^;]*catalogimportmappings/i);
  });
});
