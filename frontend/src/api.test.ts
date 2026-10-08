import {afterEach,describe,expect,it,vi} from "vitest";
import {ApiClient} from "./api";
import type {AuthAdapter} from "./auth";

const auth:AuthAdapter={getAccessToken:async()=>"token",getFixtureUser:()=>null,login:async()=>{},logout:async()=>{}};
afterEach(()=>vi.unstubAllGlobals());
describe("API errors",()=>{
  it("preserves backend error codes and messages",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:false,error:{code:"INSUFFICIENT_STOCK",message:"Only one remains."}}),{status:409})));await expect(new ApiClient(auth,"/api").request("reservations")).rejects.toMatchObject({code:"INSUFFICIENT_STOCK",message:"Only one remains.",status:409});});
  it("turns connection failures into a safe network error",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>{throw new TypeError("secret network detail")}));await expect(new ApiClient(auth,"/api").request("products")).rejects.toMatchObject({code:"NETWORK_ERROR",message:"The service is currently unreachable.",status:0});});
  it("posts customer onboarding with bearer authentication",async()=>{const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{void input;void init;return new Response(JSON.stringify({success:true,data:{id:"7",role:"Customer"}}),{status:201})});vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").onboard({schoolId:"2026-7",fullName:"New User",customerType:"Student"});expect(fetcher).toHaveBeenCalledWith("/api/onboarding/customer",expect.objectContaining({method:"POST",headers:expect.any(Headers)}));expect((fetcher.mock.calls[0]![1]!.headers as Headers).get("Authorization")).toBe("Bearer token");});
});
