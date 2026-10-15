import {createHash} from "node:crypto";
import {AppError} from "../lib/errors.js";
import {evidenceObjectId,validateEvidenceFile} from "./payment-evidence.js";
import type {User} from "../domain/models.js";

export interface MalwareScanner{scan(bytes:Uint8Array):Promise<"clean"|"infected"|"unavailable">}
export class UnavailableScanner implements MalwareScanner{async scan(){return "unavailable" as const}}
export class HttpMalwareScanner implements MalwareScanner{
  constructor(private url=process.env.MALWARE_SCANNER_URL,private token=process.env.MALWARE_SCANNER_TOKEN,private fetcher:typeof fetch=fetch){}
  async scan(bytes:Uint8Array){
    if(!this.url||!this.token)return "unavailable" as const;
    try{const response=await this.fetcher(this.url,{method:"POST",headers:{authorization:`Bearer ${this.token}`,"content-type":"application/octet-stream"},body:bytes as BodyInit,signal:AbortSignal.timeout(8000)});if(!response.ok)return "unavailable" as const;const body=await response.json() as {status?:unknown};return body.status==="clean"||body.status==="infected"?body.status:"unavailable";}
    catch{return "unavailable" as const}
  }
}

export class PaymentEvidenceStorage{
  constructor(private scanner:MalwareScanner=new HttpMalwareScanner(),private fetcher:typeof fetch=fetch){}
  private config(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new AppError("CONFIGURATION_ERROR","Private payment evidence storage is unavailable.");return{url,key}}
  async upload(customerId:string,reservationId:string,contentType:string,bytes:Uint8Array){validateEvidenceFile(contentType,bytes);if(await this.scanner.scan(bytes)!=="clean")throw new AppError("FORBIDDEN","Payment evidence did not pass security screening.");const{url,key}=this.config(),objectId=evidenceObjectId(customerId,reservationId),response=await this.fetcher(`${url}/storage/v1/object/payment-evidence/${objectId}`,{method:"POST",headers:{authorization:`Bearer ${key}`,apikey:key,"content-type":contentType,"x-upsert":"false"},body:bytes as BodyInit,signal:AbortSignal.timeout(8000)});if(!response.ok)throw new AppError("EXTERNAL_SERVICE_ERROR","Payment evidence could not be stored.");return{storageObjectId:objectId,contentType,size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),scanStatus:"clean" as const};}
  async signedRead(objectId:string,user:Pick<User,"id"|"role">,seconds=300){if(user.role==="Customer"&&!objectId.startsWith(`${encodeURIComponent(user.id)}/`))throw new AppError("FORBIDDEN","Payment evidence is not available to this user.");if(seconds<1||seconds>300)throw new AppError("VALIDATION_ERROR","Evidence URL lifetime is invalid.");const{url,key}=this.config(),response=await this.fetcher(`${url}/storage/v1/object/sign/payment-evidence/${encodeURI(objectId)}`,{method:"POST",headers:{authorization:`Bearer ${key}`,apikey:key,"content-type":"application/json"},body:JSON.stringify({expiresIn:seconds}),signal:AbortSignal.timeout(8000)});const body=await response.json().catch(()=>null) as {signedURL?:unknown}|null;if(!response.ok||typeof body?.signedURL!=="string")throw new AppError("EXTERNAL_SERVICE_ERROR","Payment evidence could not be opened.");return{url:`${url}/storage/v1${body.signedURL}`,expiresIn:seconds};}
  async delete(objectId:string){const{url,key}=this.config(),response=await this.fetcher(`${url}/storage/v1/object/payment-evidence/${encodeURI(objectId)}`,{method:"DELETE",headers:{authorization:`Bearer ${key}`,apikey:key},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new AppError("EXTERNAL_SERVICE_ERROR","Payment evidence could not be deleted.");}
}
