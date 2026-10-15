import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
import {z} from "zod";
import {AppError} from "../lib/errors.js";

export const evidenceTypes={"image/jpeg":[0xff,0xd8,0xff],"image/png":[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],"application/pdf":[0x25,0x50,0x44,0x46,0x2d]} as const;

export function validateEvidenceFile(contentType:string,bytes:Uint8Array){
  const signature=evidenceTypes[contentType as keyof typeof evidenceTypes];
  if(!signature||bytes.length===0||bytes.length>5_000_000||!signature.every((value,index)=>bytes[index]===value))throw new AppError("VALIDATION_ERROR","Payment evidence file is invalid.");
}

export const evidenceObjectId=(customerId:string,reservationId:string)=>`${encodeURIComponent(customerId)}/${encodeURIComponent(reservationId)}/${randomUUID()}`;

export const evidenceReceipt=z.object({fileName:z.string().trim().min(1).max(200),contentType:z.enum(["image/jpeg","image/png","application/pdf"]),size:z.number().int().positive().max(5_000_000),sha256:z.string().regex(/^[a-f0-9]{64}$/i),storageObjectId:z.string().trim().min(1).max(300),scanStatus:z.literal("clean"),ownerId:z.string().min(1),reservationId:z.string().min(1),uploadedAt:z.string().datetime()}).strict();
export type EvidenceReceipt=z.infer<typeof evidenceReceipt>;
const evidenceSecret=()=>{const secret=process.env.PAYMENT_EVIDENCE_SECRET;if(!secret||secret.length<32)throw new AppError("CONFIGURATION_ERROR","Payment evidence signing is unavailable.");return secret};
export function signEvidenceReceipt(receipt:EvidenceReceipt){const payload=Buffer.from(JSON.stringify(evidenceReceipt.parse(receipt))).toString("base64url"),signature=createHmac("sha256",evidenceSecret()).update(payload).digest("base64url");return`${payload}.${signature}`;}
export function verifyEvidenceReceipt(token:string,ownerId:string,reservationId:string){const[payload,provided,...extra]=token.split(".");if(!payload||!provided||extra.length)throw new AppError("VALIDATION_ERROR","Payment evidence proof is invalid.");const expected=createHmac("sha256",evidenceSecret()).update(payload).digest();let signature:Buffer;try{signature=Buffer.from(provided,"base64url")}catch{throw new AppError("VALIDATION_ERROR","Payment evidence proof is invalid.")}if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw new AppError("VALIDATION_ERROR","Payment evidence proof is invalid.");let parsed:unknown;try{parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"))}catch{throw new AppError("VALIDATION_ERROR","Payment evidence proof is invalid.")}const receipt=evidenceReceipt.parse(parsed);if(receipt.ownerId!==ownerId||receipt.reservationId!==reservationId||!receipt.storageObjectId.startsWith(`${encodeURIComponent(ownerId)}/${encodeURIComponent(reservationId)}/`))throw new AppError("FORBIDDEN","Payment evidence does not belong to this reservation.");return receipt;}
