import type {User} from "./types";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {isStaticPreview,previewUnavailable} from "./deployment-mode";
import {createFixtureAuthAdapter,fixtureAuthMode} from "./fixture-auth-runtime";
export interface Registration{email:string;fullName:string;password:string;confirmPassword:string}
export interface AuthAdapter{getAccessToken(signal?:AbortSignal):Promise<string|null>;getFixtureUser():User|null;login(email:string,password:string):Promise<void>;startGoogleSignIn():Promise<void>;completeGoogleSignIn():Promise<void>;requestOtp(email:string):Promise<void>;verifyOtp(email:string,token:string):Promise<void>;register(input:Registration):Promise<void>;requestPasswordReset(email:string):Promise<void>;logout():Promise<void>}
type Envelope<T>={success:boolean;data?:T;error?:{message:string}};
export class SupabaseAuthAdapter implements AuthAdapter{
  private accessToken:string|null=null;
  private expiresAt=0;
  private restoreAttempted=false;
  private refreshPromise:Promise<string|null>|null=null;
  private oauth:SupabaseClient|null|undefined;
  constructor(private baseUrl=import.meta.env.VITE_API_BASE_URL??"/api"){}
  async getAccessToken(){if(isStaticPreview)return null;if(this.accessToken&&Date.now()<this.expiresAt-30_000)return this.accessToken;const oauth=this.client();if(oauth){const{data:{session}}=await oauth.auth.getSession();if(session){this.setSession({accessToken:session.access_token,expiresIn:Math.max(1,Math.floor((session.expires_at??0)-Date.now()/1000))});return this.accessToken;}}if(this.refreshPromise)return this.refreshPromise;if(!this.accessToken&&this.restoreAttempted)return null;this.restoreAttempted=true;return this.refreshPromise=this.refresh().finally(()=>{this.refreshPromise=null});}
  async login(identity:string,password:string){if(isStaticPreview)throw new Error(previewUnavailable);const data=await this.post<{accessToken:string;expiresIn:number}>("auth/login",{identity,password});this.setSession(data);}
  async startGoogleSignIn(){if(isStaticPreview)throw new Error(previewUnavailable);const client=this.client();if(!client)throw new Error("Google sign-in is not configured.");const redirectTo=new URL("auth/callback",window.location.origin).href,{error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo}});if(error)throw new Error("Google sign-in could not be started.");}
  async completeGoogleSignIn(){const client=this.client(),code=new URLSearchParams(window.location.search).get("code");if(!client||!code)throw new Error("Invalid Google sign-in callback.");const{data,error}=await client.auth.exchangeCodeForSession(code);if(error||!data.session)throw new Error("Google sign-in could not be completed.");this.setSession({accessToken:data.session.access_token,expiresIn:Math.max(1,Math.floor((data.session.expires_at??0)-Date.now()/1000))});}
  async requestOtp(email:string){if(isStaticPreview)throw new Error(previewUnavailable);await this.post("auth/otp",{email});}
  async verifyOtp(email:string,token:string){if(isStaticPreview)throw new Error(previewUnavailable);const data=await this.post<{accessToken:string;expiresIn:number}>("auth/otp/verify",{email,token});this.setSession(data);}
  async register(input:Registration){if(isStaticPreview)throw new Error(previewUnavailable);await this.post("auth/register",input);}
  async requestPasswordReset(identity:string){if(isStaticPreview)throw new Error(previewUnavailable);await this.post("auth/recovery",{identity});}
  async logout(){try{if(!isStaticPreview)await this.post("auth/logout",undefined,this.accessToken?{authorization:`Bearer ${this.accessToken}`}:{})}finally{this.accessToken=null;this.expiresAt=0;this.restoreAttempted=true;}}
  getFixtureUser(){return null;}
  private async refresh(){try{const data=await this.post<{accessToken:string;expiresIn:number}>("auth/refresh");this.setSession(data);return data.accessToken}catch{this.accessToken=null;this.expiresAt=0;return null}}
  private setSession(data:{accessToken:string;expiresIn:number}){this.accessToken=data.accessToken;this.expiresAt=Date.now()+data.expiresIn*1000;this.restoreAttempted=true;}
  private client(){if(this.oauth!==undefined)return this.oauth;const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;return this.oauth=url&&key?createClient(url,key,{auth:{flowType:"pkce",detectSessionInUrl:false}}):null;}
  private async post<T=unknown>(path:string,body?:unknown,extraHeaders:Record<string,string>={}){if(isStaticPreview)throw new Error(previewUnavailable);const headers={"accept":"application/json",...extraHeaders,...(body===undefined?{}:{"content-type":"application/json"})},response=await fetch(`${this.baseUrl}/${path}`,{method:"POST",credentials:"same-origin",headers,body:body===undefined?undefined:JSON.stringify(body)}),payload=await response.json().catch(()=>null) as Envelope<T>|null;if(!response.ok||!payload?.success)throw new Error(payload?.error?.message??(response.status>=500?"Authentication service is unavailable. Check that the local API is running.":"The request could not be completed."));return payload.data as T;}
}
export {fixtureAuthMode};
export function createAuthAdapter():AuthAdapter{return fixtureAuthMode?createFixtureAuthAdapter():new SupabaseAuthAdapter();}
