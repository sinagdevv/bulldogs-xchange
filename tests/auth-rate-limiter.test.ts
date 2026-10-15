import {describe,expect,it,vi} from "vitest";
import {AuthRateLimiter,MemoryRateLimitStore,PostgresRateLimitStore,UpstashRateLimitStore} from "../src/services/auth-rate-limiter.js";

const request=(email="student@students.nu-fairview.edu.ph")=>({headers:{"x-forwarded-for":"203.0.113.4"},body:{email}});

describe("authentication rate limiter",()=>{
  it("makes concurrent decisions atomically per account",async()=>{const limiter=new AuthRateLimiter(new MemoryRateLimitStore(),"test-secret");const results=await Promise.allSettled(Array.from({length:11},()=>limiter.check(request())));expect(results.filter(x=>x.status==="fulfilled")).toHaveLength(10);expect(results.filter(x=>x.status==="rejected")).toHaveLength(1)});
  it("does not store plaintext account or IP identifiers",async()=>{const keys:string[]=[];const limiter=new AuthRateLimiter({increment:async key=>(keys.push(key),1)},"test-secret");process.env.VERCEL="1";await limiter.check(request());delete process.env.VERCEL;expect(keys).toHaveLength(2);expect(keys.join(" ")).not.toContain("student@");expect(keys.join(" ")).not.toContain("203.0.113.4")});
  it("uses one Redis script for increment and expiry",async()=>{const fetcher=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response(JSON.stringify({result:1}),{status:200}));await new UpstashRateLimitStore("https://redis.example.test","secret",fetcher as typeof fetch).increment("key",60);const init=fetcher.mock.calls[0]![1]!;expect(String(init.body)).toContain("INCR");expect(String(init.body)).toContain("EXPIRE");expect(String(init.body)).not.toContain("secret")});
  it("fails closed when the shared store is unavailable",async()=>{const limiter=new AuthRateLimiter({increment:async()=>{throw new Error("offline")}},"test-secret");await expect(limiter.check(request())).rejects.toMatchObject({code:"CONFIGURATION_ERROR",status:503})});
  it("requires the dedicated HMAC secret in production",async()=>{const previousNode=process.env.NODE_ENV;process.env.NODE_ENV="production";delete process.env.AUTH_RATE_LIMIT_SECRET;try{await expect(new AuthRateLimiter({increment:async()=>1}).check(request())).rejects.toMatchObject({code:"CONFIGURATION_ERROR",status:503})}finally{process.env.NODE_ENV=previousNode}});
});

describe("PostgresRateLimitStore",()=>{
  function mockSql(count:number){return{query:vi.fn(async()=>[{count}])}}
  it("returns the database count on increment",async()=>{const sql=mockSql(3);const store=new PostgresRateLimitStore(sql as never);await expect(store.increment("key",60)).resolves.toBe(3)});
  it("rejects a non-integer count from the database",async()=>{const sql={query:vi.fn(async()=>[{count:null}])};const store=new PostgresRateLimitStore(sql as never);await expect(store.increment("key",60)).rejects.toThrow("Invalid rate-limit response")});
  it("rejects a count below 1",async()=>{const sql=mockSql(0);const store=new PostgresRateLimitStore(sql as never);await expect(store.increment("key",60)).rejects.toThrow("Invalid rate-limit response")});
  it("fires probabilistic cleanup without blocking",async()=>{const queries:string[]=[];const sql={query:vi.fn(async(sql:string)=>{queries.push(sql);return sql.includes("INSERT")?"":"" as never})};const store=new PostgresRateLimitStore(sql as never);vi.spyOn(Math,"random").mockReturnValueOnce(0);await store.increment("key",60);await new Promise(r=>setTimeout(r,10));expect(queries.some(q=>q.includes("DELETE"))).toBe(true);vi.restoreAllMocks()});
  it("creates a functional store when sql is provided to the factory",()=>{const sql={query:vi.fn(async()=>[{count:1}])};const store=new (PostgresRateLimitStore)(sql as never);expect(store).toBeInstanceOf(PostgresRateLimitStore)});
});
