import {describe,expect,it} from "vitest";
import {cashDeadline,gcashDeadline} from "../src/services/financial-policy.js";
import {evidenceObjectId,validateEvidenceFile} from "../src/services/payment-evidence.js";

describe("financial policy",()=>{
  it("uses 24 elapsed hours for GCash",()=>expect(gcashDeadline(new Date("2026-10-09T08:00:00Z")).toISOString()).toBe("2026-10-10T08:00:00.000Z"));
  it("uses the second full open counter day and skips closures",()=>{const hours=[1,2,3,4,5].map(weekday=>({weekday,closesAt:"17:00"}));expect(cashDeadline(new Date("2026-10-09T03:00:00Z"),hours,["2026-10-12"]).toISOString()).toBe("2026-10-14T09:00:00.000Z")});
  it("rejects missing counter calendars",()=>expect(()=>cashDeadline(new Date(),[],[])).toThrow("calendar"));
  it("checks file signatures and randomizes private object IDs",()=>{expect(()=>validateEvidenceFile("image/png",new Uint8Array([1,2,3]))).toThrow("invalid");validateEvidenceFile("application/pdf",new TextEncoder().encode("%PDF-1.7"));expect(evidenceObjectId("7","9")).not.toBe(evidenceObjectId("7","9"))});
});
