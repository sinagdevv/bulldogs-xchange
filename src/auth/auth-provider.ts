import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "../lib/errors.js";
import type { RequestLike } from "../lib/http.js";

export interface AuthenticatedPrincipal { subject: string; email: string; provider?:"email"|"google"; displayName?:string }
export interface AuthProvider { authenticate(req: RequestLike): Promise<AuthenticatedPrincipal | null> }

const header=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export class SupabaseAuthProvider implements AuthProvider {
  private jwks?:ReturnType<typeof createRemoteJWKSet>;
  constructor(private fetcher:typeof fetch=fetch){}

  async authenticate(req:RequestLike):Promise<AuthenticatedPrincipal|null>{
    const authorization=header(req.headers.authorization);
    if(!authorization)return null;
    const match=/^Bearer\s+(\S+)$/i.exec(authorization);
    if(!match)throw new AppError("UNAUTHORIZED","Invalid authentication token.");
    const projectRef=process.env.SUPABASE_PROJECT_REF,issuer=projectRef?`https://${projectRef}.supabase.co/auth/v1`:undefined,audience="authenticated",jwksUrl=issuer?`${issuer}/.well-known/jwks.json`:undefined;
    if(!issuer||!jwksUrl)throw new AppError("CONFIGURATION_ERROR","Supabase authentication is not configured.");
    try{
      const url=new URL(jwksUrl); if(url.protocol!=="https:")throw new Error("JWKS must use HTTPS.");
      this.jwks??=createRemoteJWKSet(url);
      const {payload}=await jwtVerify(match[1]!,this.jwks,{issuer,audience});
      const amr=Array.isArray(payload.amr)?payload.amr:[],amrEntry=amr.find(value=>typeof value==="object"&&value!==null&&"method" in value) as {method:unknown}|undefined,method=amrEntry?String(amrEntry.method):"",verified=["password","otp","oauth"].includes(method);
      if(typeof payload.sub!=="string"||typeof payload.email!=="string"||payload.is_anonymous===true||!verified)throw new Error("Required verified identity claims are missing.");
      const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;
      if(!publishableKey)throw new Error("Supabase publishable key is missing.");
      const response=await this.fetcher(`${issuer}/user`,{headers:{apikey:publishableKey,authorization:`Bearer ${match[1]}`}});
      if(!response.ok)throw new Error("Identity lookup failed.");
      const user=await response.json() as {id?:string;email?:string;email_confirmed_at?:string|null;app_metadata?:{provider?:string};identities?:{provider?:string}[];user_metadata?:{full_name?:string}};
      if(user.id!==payload.sub||!user.email_confirmed_at||user.email?.trim().toLowerCase()!==payload.email.trim().toLowerCase())throw new Error("Institutional email is not verified.");
      const provider=user.app_metadata?.provider;if(provider!=="email"&&provider!=="google")throw new Error("Unsupported identity provider.");if(method==="oauth"&&(!user.identities?.some(identity=>identity.provider==="google")||provider!=="google"))throw new Error("Google identity is not verified.");
      return {subject:payload.sub,email:payload.email.trim().toLowerCase(),provider,displayName:user.user_metadata?.full_name};
    }catch{throw new AppError("UNAUTHORIZED","Invalid or expired authentication token.");}
  }
}
