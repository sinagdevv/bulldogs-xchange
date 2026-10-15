import { afterEach, describe, expect, it } from "vitest";
import { refreshCookie } from "../src/app.js";

const environment={node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV};
afterEach(()=>{process.env.NODE_ENV=environment.node;if(environment.vercel===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=environment.vercel;});

describe("refresh cookie transport security",()=>{
  it.each([["development",undefined,false],["test","preview",true],["production",undefined,true]] as const)("uses Secure=%s/%s",(node,vercel,secure)=>{process.env.NODE_ENV=node;if(vercel===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=vercel;const cookie=refreshCookie("token",0);expect(cookie).toContain("Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=0");expect(cookie.includes("; Secure")).toBe(secure);});
});
