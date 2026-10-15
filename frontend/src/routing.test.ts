import {describe,expect,it} from "vitest";
import {pathAllowed,postLoginTarget,roleHome} from "./routing";
import type {Role,Session} from "./types";

const as=(role:Role,extra:object={}):Session=>({authenticated:true,user:{id:"1",email:"x@example.com",displayName:"X",role,...extra}});
describe("post-login redirect",()=>{
  it("sends each role to its canonical home from a public page",()=>{
    expect(postLoginTarget(as("Customer"),"/")).toBe("/home");
    expect(postLoginTarget(as("Staff"),"/")).toBe("/staff");
    expect(postLoginTarget(as("Admin"),"/catalog")).toBe("/admin");
  });
  it("keeps a permitted deep link and moves users off areas their role cannot open",()=>{
    expect(postLoginTarget(as("Customer"),"/reservations/abc")).toBeNull();
    expect(postLoginTarget(as("Staff"),"/staff/queue")).toBeNull();
    expect(postLoginTarget(as("Admin"),"/staff/reservations")).toBeNull();
    expect(postLoginTarget(as("Customer"),"/admin")).toBe("/home");
    expect(postLoginTarget(as("Staff"),"/admin/users")).toBe("/staff");
  });
  it("never redirects an unauthenticated session and uses only the backend role",()=>{
    expect(postLoginTarget(null,"/")).toBeNull();
    expect(postLoginTarget({authenticated:false,user:null},"/")).toBeNull();
    expect(postLoginTarget(as("Customer",{email:"admin@nu-fairview.edu.ph"}),"/")).toBe("/home");
  });
  it("sends pending, rejected, and suspended accounts to their role home, where the guard shows the status screen",()=>{
    for(const approvalStatus of ["pending","rejected","suspended"])expect(postLoginTarget(as("Customer",{approvalStatus}),"/")).toBe(roleHome("Customer"));
  });
  it("does not loop: the target is always an allowed path", ()=>{
    for(const r of ["Customer","Staff","Admin"] as Role[])expect(pathAllowed(r,roleHome(r))).toBe(true);
  });
});
