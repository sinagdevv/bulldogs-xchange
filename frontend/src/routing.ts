import type {Role,Session} from "./types";

/** Canonical landing route for each backend-assigned role. */
export const roleHome=(role:Role)=>role==="Admin"?"/admin":role==="Staff"?"/staff":"/home";

const CUSTOMER_PATHS=["/home","/shop","/reservations","/queue","/notifications","/profile"];
const under=(path:string,base:string)=>path===base||path.startsWith(`${base}/`);
/** Whether a signed-in user with this role may stay on this path. Public pages and other roles' areas return false. */
export const pathAllowed=(role:Role,path:string)=>role==="Admin"?under(path,"/admin")||under(path,"/staff"):role==="Staff"?under(path,"/staff"):CUSTOMER_PATHS.some(b=>under(path,b));

/**
 * Where to go right after a successful login, or null to stay put. A permitted deep link is kept.
 * Pending, rejected, and suspended accounts land on their role home, where the route guard renders the account-status screen.
 * The role comes only from the backend session, never from the email address.
 */
export function postLoginTarget(session:Session|null,pathname:string):string|null{
  const user=session?.user;
  if(!session?.authenticated||!user)return null;
  if(pathAllowed(user.role,pathname))return null;
  return roleHome(user.role);
}
