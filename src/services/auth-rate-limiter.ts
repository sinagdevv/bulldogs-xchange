import {createHmac} from "node:crypto";
import {AppError} from "../lib/errors.js";
import type {RequestLike} from "../lib/http.js";
import type {SqlTransactionManager} from "../integrations/sql-server.js";

export interface RateLimitStore{increment(key:string,windowSeconds:number):Promise<number>}

export class MemoryRateLimitStore implements RateLimitStore{
  private entries=new Map<string,{count:number;expires:number}>();
  async increment(key:string,windowSeconds:number){const now=Date.now(),current=this.entries.get(key);if(!current||current.expires<=now){this.entries.set(key,{count:1,expires:now+windowSeconds*1000});return 1}return ++current.count}
}

export class UpstashRateLimitStore implements RateLimitStore{
  constructor(private url:string,private token:string,private fetcher:typeof fetch=fetch){}
  async increment(key:string,windowSeconds:number){
    const response=await this.fetcher(`${this.url.replace(/\/$/,"")}/eval`,{method:"POST",headers:{authorization:`Bearer ${this.token}`,"content-type":"application/json"},body:JSON.stringify(["local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",1,key,windowSeconds]),signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error(`Rate-limit store returned ${response.status}.`);
    const result=await response.json() as {result?:unknown,error?:unknown};
    const count=Number(result.result);if(!Number.isSafeInteger(count)||count<1)throw new Error("Invalid rate-limit response.");return count;
  }
}

export class PostgresRateLimitStore implements RateLimitStore{
  private static readonly CLEANUP_PROBABILITY=0.01;
  constructor(private readonly sql:SqlTransactionManager){}
  async increment(key:string,windowSeconds:number){
    const result=await this.sql.query<{count:number}>("INSERT dbo.auth_rate_limits (key,count,expires_at) VALUES (@key,1,DATEADD(second,@windowSeconds,SYSUTCDATETIME())) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN dbo.auth_rate_limits.expires_at<=SYSUTCDATETIME() THEN 1 ELSE dbo.auth_rate_limits.count+1 END,expires_at=CASE WHEN dbo.auth_rate_limits.expires_at<=SYSUTCDATETIME() THEN DATEADD(second,@windowSeconds,SYSUTCDATETIME()) ELSE dbo.auth_rate_limits.expires_at END OUTPUT INSERTED.count",{key,windowSeconds});
    const count=result[0]?.count;
    if(typeof count!=="number"||!Number.isSafeInteger(count)||count<1)throw new Error("Invalid rate-limit response.");
    if(Math.random()<PostgresRateLimitStore.CLEANUP_PROBABILITY)this.sql.query("DELETE FROM dbo.auth_rate_limits WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'",{}).catch(()=>{});
    return count;
  }
}

const header=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const production=()=>process.env.NODE_ENV==="production"||process.env.VERCEL_ENV==="production";

export function createAuthRateLimitStore(sql?:SqlTransactionManager):RateLimitStore{
  if(sql)return new PostgresRateLimitStore(sql);
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url&&token)return new UpstashRateLimitStore(url,token);
  if(production())return{increment:async()=>{throw new AppError("CONFIGURATION_ERROR","Authentication protection is temporarily unavailable.",503)}};
  return new MemoryRateLimitStore();
}

export class AuthRateLimiter{
  constructor(private store:RateLimitStore=createAuthRateLimitStore(),private secret=process.env.AUTH_RATE_LIMIT_SECRET||(production()?undefined:process.env.AUTH_IDENTITY_SECRET||"local-development-only")){}
  async check(req:RequestLike){
    if(!this.secret)throw new AppError("CONFIGURATION_ERROR","Authentication protection is temporarily unavailable.",503);
    const email=typeof req.body==="object"&&req.body!==null&&"email" in req.body?String((req.body as {email?:unknown}).email??"").trim().toLowerCase():"unknown";
    const forwarded=process.env.VERCEL?header(req.headers["x-forwarded-for"])?.split(",")[0]?.trim():undefined;
    const identifiers=[["account",email,10],["ip",forwarded||"local",30]] as const;
    try{for(const[type,value,limit]of identifiers){const key=`auth:${type}:${createHmac("sha256",this.secret).update(value).digest("hex")}`;if(await this.store.increment(key,60)>limit)throw new AppError("FORBIDDEN","Too many authentication attempts. Try again shortly.",429)}}
    catch(error){if(error instanceof AppError)throw error;throw new AppError("CONFIGURATION_ERROR","Authentication protection is temporarily unavailable.",503)}
  }
}
