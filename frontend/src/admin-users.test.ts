import {describe,expect,it} from "vitest";
import {filterUsers} from "./admin-user-rules";
import type {User} from "./types";
const users:User[]=[{id:"1",email:"customer@example.test",displayName:"Customer",role:"Customer",customerType:"Student",isActive:true,approvalStatus:"pending"},{id:"2",email:"staff@example.test",displayName:"Staff",role:"Staff",customerType:"Faculty/Teacher",isActive:false,approvalStatus:"suspended"}];
describe("Admin user directory",()=>{it("filters by search, role, approval status, and customer type",()=>{expect(filterUsers(users,"staff","Staff","suspended","Faculty/Teacher")).toEqual([users[1]]);expect(filterUsers(users,"","","","Student")).toEqual([users[0]]);expect(filterUsers(users,"missing","","")).toEqual([])});});
