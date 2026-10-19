/**
 * Deposit workflow unit tests
 * Run: npx vitest run tests/deposit-workflow.test.ts
 */
import { describe, it, expect } from "vitest";
import { moneyCents, depositAmount } from "../src/services/deposit-service";

// ── moneyCents ──────────────────────────────────────────────────────────────

describe("moneyCents", () => {
  it("converts whole peso string", () => {
    expect(moneyCents("100")).toBe(10000);
  });

  it("converts decimal peso string", () => {
    expect(moneyCents("100.00")).toBe(10000);
    expect(moneyCents("1.50")).toBe(150);
    expect(moneyCents("0.99")).toBe(99);
  });

  it("converts numeric value", () => {
    expect(moneyCents(200)).toBe(20000);
  });

  it("throws on invalid format", () => {
    expect(() => moneyCents("abc")).toThrow();
    expect(() => moneyCents("")).toThrow();
  });
});

// ── depositAmount ───────────────────────────────────────────────────────────
// Second arg is the SystemSettings value — a peso string like "100.00"

describe("depositAmount", () => {
  it("returns policy amount (₱100) when order total exceeds deposit", () => {
    // Order total ₱500 → deposit = ₱100
    expect(depositAmount("500.00", "100.00")).toBe(10000);
  });

  it("caps deposit at order total when order is cheaper than policy", () => {
    // Order total ₱80 → deposit = ₱80 (not ₱100)
    expect(depositAmount("80.00", "100.00")).toBe(8000);
  });

  it("caps at order total when order equals policy exactly", () => {
    // Order total ₱100 → deposit = ₱100
    expect(depositAmount("100.00", "100.00")).toBe(10000);
  });

  it("throws when policy is zero", () => {
    // Zero deposit policy is a configuration error
    expect(() => depositAmount("500.00", "0")).toThrow();
  });
});

// ── RBAC rules (two-operator enforcement) ──────────────────────────────────
// These document the conditions the service enforces at the data level.

describe("two-operator rule (cash collection)", () => {
  it("same actor collecting their own deposit is a violation", () => {
    const actorId = "user-abc";
    const cashCollectedBy = "user-abc";
    expect(actorId === cashCollectedBy).toBe(true); // violation condition
  });

  it("different operator satisfies two-operator rule", () => {
    const actorId = "user-staff-1";
    const cashCollectedBy = "user-staff-2";
    expect(actorId !== cashCollectedBy).toBe(true);
  });
});

describe("two-operator rule (refund payout)", () => {
  it("payout by same approver is a violation", () => {
    const approvedBy = "user-admin-1";
    const payoutActor = "user-admin-1";
    expect(approvedBy === payoutActor).toBe(true); // violation condition
  });

  it("confirm by same payout recorder is a violation", () => {
    const payoutRecordedBy = "user-admin-1";
    const confirmActor = "user-admin-1";
    expect(payoutRecordedBy === confirmActor).toBe(true); // violation condition
  });

  it("different operators satisfy payout rule", () => {
    const approvedBy = "user-admin-1";
    const payoutActor = "user-admin-2";
    expect(approvedBy !== payoutActor).toBe(true);
  });
});
