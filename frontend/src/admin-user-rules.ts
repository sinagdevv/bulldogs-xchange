import type {User} from "./types";
export const filterUsers=(users:User[],search:string,role:string,status:string)=>users.filter(user=>(!search||`${user.displayName} ${user.email} ${user.schoolId??""}`.toLowerCase().includes(search.toLowerCase()))&&(!role||user.role===role)&&(!status||user.approvalStatus===status));
