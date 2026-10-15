import {describe,expect,it} from "vitest";
import {filterUsers} from "./admin-user-rules";
import type {User} from "./types";
const users:User[]=[{id:"1",email:"customer@example.test",displayName:"Customer",role:"Customer",isActive:true,approvalStatus:"pending"},{id:"2",email:"staff@example.test",displayName:"Staff",role:"Staff",isActive:false,approvalStatus:"suspended"}];
describe("Admin user directory",()=>{it("filters by search, role, and approval status",()=>{expect(filterUsers(users,"staff","Staff","suspended")).toEqual([users[1]]);expect(filterUsers(users,"missing","","")).toEqual([])});});
