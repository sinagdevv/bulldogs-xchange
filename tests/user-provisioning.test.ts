import {describe,expect,it} from "vitest";
import type {SqlExecutor,SqlTransactionManager} from "../src/integrations/sql-server.js";
import {UserProvisioningService} from "../src/services/user-provisioning-service.js";

const identity={subject:"supabase-customer",email:"new@students.nu-fairview.edu.ph"};
function manager(handler:(sql:string,params:Record<string,unknown>)=>Record<string,unknown>[]):SqlTransactionManager&{seen:string[]}{const seen:string[]=[];const executor:SqlExecutor={dialect:"postgres",query:async(sql,params={})=>{seen.push(sql);return handler(sql,params) as never}};return{dialect:"postgres",seen,query:executor.query,transaction:async work=>work(executor)}}

describe("user provisioning",()=>{
  it("rejects unsupported customer email domains before SQL writes",()=>{const db=manager(()=>[]);expect(()=>new UserProvisioningService(db).registerCustomer({subject:"external",email:"person@example.com"},{schoolId:"2026-7",fullName:"External User",customerType:"Student"})).toThrow(expect.objectContaining({code:"FORBIDDEN"}));expect(db.seen).toHaveLength(0)});
  it("creates only a Customer from the verified token email and audits it",async()=>{const db=manager(sql=>sql.includes("INSERT dbo.Users")?[{UserId:7}]:sql.includes("WHERE u.Email")?[{UserId:7,SchoolId:"2026-7",FullName:"New User",Email:identity.email,RoleName:"Customer",CustomerType:"Student",IsActive:true}]:[]);const user=await new UserProvisioningService(db).registerCustomer(identity,{schoolId:"2026-7",fullName:"New User",customerType:"Student"});expect(user).toMatchObject({email:identity.email,role:"Customer"});expect(db.seen.some(sql=>sql.includes("RoleName='Customer'"))).toBe(true);expect(db.seen.some(sql=>sql.includes("AuditLogs"))).toBe(true);});
  it("rejects duplicate email or school ID and client-supplied roles",async()=>{const duplicate=manager(sql=>sql.includes("LOWER(u.Email)")?[{UserId:1}]:[]);await expect(new UserProvisioningService(duplicate).registerCustomer(identity,{schoolId:"2026-7",fullName:"New User",customerType:"Student"})).rejects.toMatchObject({code:"CONFLICT"});expect(()=>new UserProvisioningService(manager(()=>[])).registerCustomer(identity,{schoolId:"2026-8",fullName:"New User",customerType:"Student",role:"Admin"})).toThrow(expect.objectContaining({code:"VALIDATION_ERROR"}));});
});
