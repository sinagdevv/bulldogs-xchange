import {afterEach,describe,expect,it,vi} from "vitest";
import {ApiClient} from "./api";
import type {AuthAdapter} from "./auth";

const auth:AuthAdapter={getAccessToken:async()=>"token",getFixtureUser:()=>null,login:async()=>{},startGoogleSignIn:async()=>{},completeGoogleSignIn:async()=>{},requestOtp:async()=>{},verifyOtp:async()=>{},register:async()=>{},requestPasswordReset:async()=>{},logout:async()=>{}};
afterEach(()=>vi.unstubAllGlobals());
describe("API errors",()=>{
  it("preserves backend error codes and messages",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:false,error:{code:"INSUFFICIENT_STOCK",message:"Only one remains."}}),{status:409})));await expect(new ApiClient(auth,"/api").request("reservations")).rejects.toMatchObject({code:"INSUFFICIENT_STOCK",message:"Only one remains.",status:409});});
  it("turns connection failures into a safe network error",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>{throw new TypeError("secret network detail")}));await expect(new ApiClient(auth,"/api").request("products")).rejects.toMatchObject({code:"NETWORK_ERROR",message:"The service is currently unreachable.",status:0});});
  it("keeps source catalog products even when an image is not yet recorded",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,data:[{id:"1",title:"PE Shirt",categoryId:"1",sku:"PE-SHIRT",description:"Official PE uniform shirt",price:300,isFeatured:false,isActive:true}]}),{status:200})));await expect(new ApiClient(auth,"/api").products()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({sku:"PE-SHIRT",title:"PE Shirt"})]));});
  it("does not rewrite source catalog fields",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,data:[{id:"1",title:"NU Bulldogs Shirt",categoryId:"5",sku:"MRC-SHIRT",description:"NU Bulldogs merchandise shirt",price:299,isFeatured:true,isActive:true}]}),{status:200})));await expect(new ApiClient(auth,"/api").products()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({title:"NU Bulldogs Shirt",description:"NU Bulldogs merchandise shirt"})]));});
  it("cross-lists the restored traditional skirt under both the SHS and College filters, without duplicating it in the unfiltered view",async()=>{
    const fetcher=vi.fn<typeof fetch>(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes("category=cat-shs"))return new Response(JSON.stringify({success:true,data:[{id:"1",title:"SHS Polo",categoryId:"cat-shs",sku:"SHS-POLO-M",description:"",price:650,isFeatured:false,isActive:true}]}),{status:200});
      if(url.includes("category=cat-college"))return new Response(JSON.stringify({success:true,data:[{id:"2",title:"College Polo",categoryId:"cat-college",sku:"COL-POLO-M",description:"",price:650,isFeatured:false,isActive:true}]}),{status:200});
      return new Response(JSON.stringify({success:true,data:[{id:"1",title:"SHS Polo",categoryId:"cat-shs",sku:"SHS-POLO-M",description:"",price:650,isFeatured:false,isActive:true},{id:"2",title:"College Polo",categoryId:"cat-college",sku:"COL-POLO-M",description:"",price:650,isFeatured:false,isActive:true}]}),{status:200});
    });
    vi.stubGlobal("fetch",fetcher);
    const client=new ApiClient(auth,"/api");
    const shsView=await client.products({category:"cat-shs"});
    expect(shsView.filter(p=>p.sku==="TRAD-SKRT-001")).toHaveLength(1);
    const collegeView=await client.products({category:"cat-college"});
    expect(collegeView.filter(p=>p.sku==="TRAD-SKRT-001")).toHaveLength(1);
    const allView=await client.products();
    expect(allView.filter(p=>p.sku==="TRAD-SKRT-001")).toHaveLength(1);
  });
  it("hides only traditional pants from public catalog and search while keeping legitimate trousers",async()=>{
    const products=[
      ...["SHS-PANTS-F","SHS-PANTS-M","COL-PANTS-F","COL-PANTS-M","COL-PANTS-W"].map((sku,index)=>({id:String(index),title:"Traditional Pants",categoryId:index<2?"cat-shs":"cat-college",sku,description:"Traditional pants",price:550,isFeatured:false,isActive:true})),
      {id:"pe",title:"PE Jogging Pants",categoryId:"cat-pe",sku:"PE-JOG",description:"Official PE jogging pants",price:400,isFeatured:false,isActive:true},
    ];
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,data:products}),{status:200})));
    const client=new ApiClient(auth,"/api");
    expect((await client.products()).map(p=>p.sku)).not.toEqual(expect.arrayContaining(["SHS-PANTS-F","SHS-PANTS-M","COL-PANTS-F","COL-PANTS-M","COL-PANTS-W"]));
    expect(await client.products()).toEqual(expect.arrayContaining([expect.objectContaining({sku:"PE-JOG"})]));
    expect((await client.products({search:"pants"})).map(p=>p.sku)).toEqual(["PE-JOG"]);
  });
  it("finds the canonical skirt through public search",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,data:[]}),{status:200})));
    const results=await new ApiClient(auth,"/api").products({search:"skirt"});
    expect(results.filter(p=>p.sku==="TRAD-SKRT-001")).toHaveLength(1);
    expect(results.find(p=>p.sku==="TRAD-SKRT-001")).toMatchObject({supplemental:true,price:-1});
  });
  it("keeps source category labels",async()=>{vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,data:[{id:"1",title:"SHS",isActive:true}]}),{status:200})));await expect(new ApiClient(auth,"/api").categories()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({title:"SHS"})]));});
  it("posts customer onboarding with bearer authentication",async()=>{const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{void input;void init;return new Response(JSON.stringify({success:true,data:{id:"7",role:"Customer"}}),{status:201})});vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").onboard({schoolId:"2026-7",fullName:"New User",customerType:"Student"});expect(fetcher).toHaveBeenCalledWith("/api/onboarding/customer",expect.objectContaining({method:"POST",headers:expect.any(Headers)}));expect((fetcher.mock.calls[0]![1]!.headers as Headers).get("Authorization")).toBe("Bearer token");});
  it("loads Admin users and changes roles through existing endpoints",async()=>{const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{void init;return new Response(JSON.stringify({success:true,data:String(input).endsWith("/role")?{id:"7",role:"Staff"}:[]}),{status:200})});vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").users();await new ApiClient(auth,"/api").changeUserRole("7","Staff");expect(fetcher.mock.calls.map(call=>String(call[0]))).toEqual(["/api/admin/users","/api/admin/users/7/role"]);expect(fetcher.mock.calls[1]![1]).toMatchObject({method:"PUT",body:'{"role":"Staff"}'});});
  it("sends Admin catalog mutations through the protected endpoints",async()=>{const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({success:true,data:{id:"1"}}),{status:201}));vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").createProduct({name:"PE Shirt",categoryId:1,sku:"PE-SHIRT",price:300,isFeatured:false,isActive:true});expect(fetcher.mock.calls[0]).toMatchObject(["/api/admin/products",{method:"POST",body:'{"name":"PE Shirt","categoryId":1,"sku":"PE-SHIRT","price":300,"isFeatured":false,"isActive":true}'}]);});
  it("encodes paginated filters without changing legacy list calls",async()=>{const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({success:true,data:{items:[],page:2,pageSize:25,total:0,totalPages:0}}),{status:200}));vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").staffReservationsPage({reservationStatus:"Pending",search:"A&B",page:2});expect(String(fetcher.mock.calls[0]?.[0])).toBe("/api/staff/reservations?reservationStatus=Pending&search=A%26B&page=2&pageSize=25")});
  it("downloads an Admin report with bearer authorization",async()=>{const fetcher=vi.fn<typeof fetch>(async()=>new Response("reference\r\nBX-1\r\n",{status:200,headers:{"content-type":"text/csv"}}));vi.stubGlobal("fetch",fetcher);await new ApiClient(auth,"/api").downloadReport("reservations","csv",{startDate:"2026-10-01"});expect(fetcher.mock.calls[0]?.[0]).toBe("/api/admin/reports/reservations.csv?startDate=2026-10-01");expect(fetcher.mock.calls[0]?.[1]).toMatchObject({headers:{authorization:"Bearer token"}})});
});
