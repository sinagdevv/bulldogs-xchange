import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "../lib/errors.js";
import type { RequestLike } from "../lib/http.js";

export interface AuthenticatedPrincipal { subject: string; email: string }
export interface AuthProvider { authenticate(req: RequestLike): Promise<AuthenticatedPrincipal | null> }

const header=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export class OidcAuthProvider implements AuthProvider {
  private jwks?:ReturnType<typeof createRemoteJWKSet>;

  async authenticate(req:RequestLike):Promise<AuthenticatedPrincipal|null>{
    const authorization=header(req.headers.authorization);
    if(!authorization)return null;
    const match=/^Bearer\s+(\S+)$/i.exec(authorization);
    if(!match)throw new AppError("UNAUTHORIZED","Invalid authentication token.");
    const issuer=process.env.AUTH_ISSUER,audience=process.env.AUTH_AUDIENCE,jwksUrl=process.env.AUTH_JWKS_URL;
    if(!issuer||!audience||!jwksUrl)throw new AppError("CONFIGURATION_ERROR","Production authentication is not configured.");
    try{
      const url=new URL(jwksUrl); if(url.protocol!=="https:")throw new Error("JWKS must use HTTPS.");
      this.jwks??=createRemoteJWKSet(url);
      const {payload}=await jwtVerify(match[1]!,this.jwks,{issuer,audience,algorithms:["RS256"]});
      if(typeof payload.sub!=="string"||typeof payload.email!=="string"||payload.email_verified!==true)throw new Error("Required identity claims are missing.");
      return {subject:payload.sub,email:payload.email.trim().toLowerCase()};
    }catch{throw new AppError("UNAUTHORIZED","Invalid or expired authentication token.");}
  }
}
