import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

describe("prepared deposit migration",()=>{
  const sql=readFileSync("supabase/migrations/20261011090000_deposit_expiration.sql","utf8");
  it("remains additive, disabled, and compatible with legacy rows",()=>{expect(sql).toContain("ADD COLUMN IF NOT EXISTS depositpolicyversion");expect(sql).toContain("'DepositWorkflowEnabled','false'");expect(sql).not.toMatch(/UPDATE dbo\.reservations/i)});
  it("enforces unique financial references and operator evidence fields",()=>{expect(sql).toContain("uq_reservationdeposits_paymentreference");expect(sql).toContain("uq_depositrefunds_refundreference");expect(sql).toContain("uq_transactions_receiptreference");expect(sql).toContain("cashreconciledbyuserid")});
  it("extends the existing reservation status constraint without requiring a description column",()=>{expect(sql).toContain("DROP CONSTRAINT IF EXISTS reservationstatuses_statusname_check");expect(sql).toContain("'Pending Deposit'");expect(sql).not.toContain("reservationstatuses(statusname,description)")});
  it("installs the GCash reference method required by the API contract",()=>{expect(sql).toContain("VALUES('GCash',true)")});
});
