import {afterEach,describe,expect,it,vi} from "vitest";
import type {SqlTransactionManager} from "../src/integrations/sql-server.js";
import {PaymentEvidenceService} from "../src/services/payment-evidence-service.js";
import {verifyEvidenceReceipt} from "../src/services/payment-evidence.js";

const customer={id:"7",email:"student@example.test",displayName:"Student",role:"Customer" as const,isActive:true,approvalStatus:"approved" as const};
const staff={...customer,id:"8",role:"Staff" as const};
const admin={...customer,id:"9",role:"Admin" as const};
const pdf=Buffer.from("%PDF-1.7 safe").toString("base64");
const receipt={fileName:"receipt.pdf",contentType:"application/pdf",size:13,sha256:"a".repeat(64),storageObjectId:"7/4/object",scanStatus:"clean",ownerId:"7",reservationId:"4",uploadedAt:"2026-10-11T00:00:00.000Z"};
function setup(row:Record<string,unknown>={ReservationDepositId:1,CustomerId:7,VerificationStatus:"Awaiting Payment",PaymentMethodName:"GCash"}){const seen:{sql:string;params:Record<string,unknown>}[]=[];const db:SqlTransactionManager={dialect:"postgres",query:async(sql,params={})=>{seen.push({sql,params});return(sql.startsWith("SELECT")?[row]:[]) as never},transaction:async work=>work(db)};const storage={upload:vi.fn(async()=>({contentType:"application/pdf",size:13,sha256:"a".repeat(64),storageObjectId:"7/4/object",scanStatus:"clean" as const})),signedRead:vi.fn(async()=>({url:"https://signed.example.test",expiresIn:300})),delete:vi.fn(async()=>{})};return{service:new PaymentEvidenceService(db,storage as never),storage,seen};}
afterEach(()=>delete process.env.PAYMENT_EVIDENCE_SECRET);

describe("payment evidence integration",()=>{
  it("binds a clean upload token to its owner and reservation and audits it",async()=>{process.env.PAYMENT_EVIDENCE_SECRET="test-only-payment-evidence-secret-123";const x=setup(),result=await x.service.upload(4,{fileName:"receipt.pdf",contentType:"application/pdf",dataBase64:pdf},customer);expect(verifyEvidenceReceipt(result.evidenceToken,"7","4")).toMatchObject({storageObjectId:"7/4/object",scanStatus:"clean"});expect(x.seen.some(call=>call.sql.startsWith("INSERT dbo.AuditLogs"))).toBe(true)});
  it("rejects cross-owner upload before storage",async()=>{const x=setup({...receipt,ReservationDepositId:1,CustomerId:99,VerificationStatus:"Awaiting Payment",PaymentMethodName:"GCash"});await expect(x.service.upload(4,{fileName:"receipt.pdf",contentType:"application/pdf",dataBase64:pdf},customer)).rejects.toMatchObject({code:"NOT_FOUND"});expect(x.storage.upload).not.toHaveBeenCalled()});
  it("allows audited Staff review for clean evidence only",async()=>{const x=setup({EvidenceMetadata:receipt});await expect(x.service.review(1,staff)).resolves.toMatchObject({expiresIn:300});expect(x.storage.signedRead).toHaveBeenCalledWith("7/4/object",staff,300);expect(x.seen.some(call=>call.params.action==="PaymentEvidenceViewed")).toBe(true)});
  it("provides an audited Admin retention deletion hook",async()=>{const x=setup({EvidenceMetadata:receipt});await x.service.delete(1,admin,"retention expired");expect(x.storage.delete).toHaveBeenCalledWith("7/4/object");expect(x.seen.some(call=>call.params.action==="PaymentEvidenceDeleted")).toBe(true)});
});
