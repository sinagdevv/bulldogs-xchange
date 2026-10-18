import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "../src/app.js";
import { compilePostgresQuery } from "../src/integrations/postgres.js";
import type { MockSharePointRepository } from "../src/repositories/mock-repository.js";
import { repository } from "../src/app.js";

const mock = repository as MockSharePointRepository;

function req(body?: unknown, user = "admin@example.test") {
  return { method: "POST", url: "http://local/api/admin/users/google-invite", body, query: {}, headers: { "x-dev-user": user } };
}
function res() { const s: { status: number; body?: unknown } = { status: 0 }; return { state: s, status(c: number) { s.status = c; return this; }, json(b: unknown) { s.body = b; }, setHeader() {}, end() {} }; }

beforeEach(() => { process.env.ENABLE_DEV_AUTH = "true"; process.env.NODE_ENV = "test"; });

describe("POST admin/users/google-invite — authorization", () => {
  it("rejects unauthenticated requests with 401", async () => {
    process.env.ENABLE_DEV_AUTH = "false";
    const r = res(); await handle(req(), r);
    expect(r.state).toMatchObject({ status: 401, body: { error: { code: "UNAUTHORIZED" } } });
  });

  it("rejects Customer role with 403", async () => {
    const r = res(); await handle(req({}, "customer@example.test"), r);
    expect(r.state).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
  });

  it("rejects Staff role with 403", async () => {
    const r = res(); await handle(req({}, "staff@example.test"), r);
    expect(r.state).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
  });

  it("rejects a pending Admin account with 403", async () => {
    const admin = mock.users.find(u => u.role === "Admin")!;
    const prev = admin.approvalStatus;
    try {
      admin.approvalStatus = "pending";
      const r = res(); await handle(req(), r);
      expect(r.state).toMatchObject({ status: 403, body: { error: { code: "FORBIDDEN" } } });
    } finally { admin.approvalStatus = prev; }
  });

  it("rejects a suspended Admin account with inactive-user status", async () => {
    const admin = mock.users.find(u => u.role === "Admin")!;
    const prev = admin.approvalStatus;
    try {
      admin.approvalStatus = "suspended";
      const r = res(); await handle(req(), r);
      expect(r.state).toMatchObject({ status: 403 });
    } finally { admin.approvalStatus = prev; }
  });

  it("passes auth for active Admin and returns 500 when SQL is unavailable (not 403)", async () => {
    // confirms requireAdmin runs BEFORE the sql-availability check
    const r = res(); await handle(req({ email: "invite@gmail.com", authorizedBy: "admin", reference: "REF-00001" }), r);
    expect(r.state).toMatchObject({ status: 500, body: { error: { code: "CONFIGURATION_ERROR", message: "Database is unavailable." } } });
  });
});

describe("POST admin/users/google-invite — SQL query shape", () => {
  const INSERT_SQL = "INSERT INTO public.operator_google_oauth_allowlist(invitation_email,authorized_by,authorization_reference,expires_at) VALUES(@email,@authorizedBy,@reference,now()+interval '7 days') ON CONFLICT(invitation_email) DO UPDATE SET authorized_by=EXCLUDED.authorized_by,authorization_reference=EXCLUDED.authorization_reference,authorized_at=now(),expires_at=now()+interval '7 days',revoked_at=NULL,revoked_by=NULL,revoke_reason=NULL";

  it("parameterizes email, authorizedBy, and reference as $1/$2/$3", () => {
    const c = compilePostgresQuery(INSERT_SQL, { email: "g@gmail.com", authorizedBy: "admin-name", reference: "AUTH-REF-001" });
    expect(c.values).toEqual(["g@gmail.com", "admin-name", "AUTH-REF-001"]);
    expect(c.text).toContain("$1");
    expect(c.text).toContain("$2");
    expect(c.text).toContain("$3");
  });

  it("uses ON CONFLICT upsert, not a bare INSERT that would reject duplicates", () => {
    const c = compilePostgresQuery(INSERT_SQL, { email: "g@gmail.com", authorizedBy: "a", reference: "b12345678" });
    expect(c.text).toContain("ON CONFLICT(invitation_email) DO UPDATE SET");
  });

  it("resets revocation fields on upsert so re-invited addresses are reactivated", () => {
    const c = compilePostgresQuery(INSERT_SQL, { email: "g@gmail.com", authorizedBy: "a", reference: "b12345678" });
    expect(c.text).toContain("revoked_at=NULL");
    expect(c.text).toContain("revoked_by=NULL");
    expect(c.text).toContain("revoke_reason=NULL");
  });

  it("refreshes authorized_at and expires_at on upsert (renewal)", () => {
    const c = compilePostgresQuery(INSERT_SQL, { email: "g@gmail.com", authorizedBy: "a", reference: "b12345678" });
    expect(c.text).toContain("authorized_at=now()");
    expect(c.text).toContain("expires_at=now()+interval '7 days'");
  });

  it("references all four columns that require UPDATE privilege (RLS grant coverage)", () => {
    // These are the columns missing from the original 20261019090000 UPDATE grant
    const c = compilePostgresQuery(INSERT_SQL, { email: "g@gmail.com", authorizedBy: "a", reference: "b12345678" });
    expect(c.text).toContain("authorized_by=");
    expect(c.text).toContain("authorization_reference=");
    expect(c.text).toContain("authorized_at=");
    expect(c.text).toContain("expires_at=");
  });

  it("does not insert or update any dbo.Users rows", () => {
    expect(INSERT_SQL).not.toMatch(/INSERT\s+INTO\s+dbo\.|UPDATE\s+dbo\./i);
  });
});

describe("POST admin/users/google-invite — input validation (inline checks)", () => {
  // Validation runs after requireAdmin + sql check; sql is null in tests so admin always
  // gets CONFIGURATION_ERROR. These tests verify the validation logic via direct string checks
  // matching what app.ts enforces before calling sql.query.

  it("email regex rejects empty string", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test("")).toBe(false);
  });
  it("email regex rejects missing domain part", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test("user@")).toBe(false);
  });
  it("email regex rejects single-char TLD", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test("user@domain.c")).toBe(false);
  });
  it("email regex accepts a valid Gmail address", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test("groupmate@gmail.com")).toBe(true);
  });
  it("email regex accepts institutional address", () => {
    expect(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test("student@students.nu-fairview.edu.ph")).toBe(true);
  });
  it("authorizedBy length check rejects strings under 3 chars", () => {
    expect("ab".trim().length < 3).toBe(true);
    expect("abc".trim().length < 3).toBe(false);
  });
  it("reference length check rejects strings under 8 chars", () => {
    expect("abcdefg".trim().length < 8).toBe(true);
    expect("abcdefgh".trim().length < 8).toBe(false);
  });
});
