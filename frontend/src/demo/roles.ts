import type {NavGroup} from "../components";
import {badgeText} from "./policy";
export const DEMO_ROOT="/design-preview";
export type DemoRole="student"|"staff"|"admin";
export const DEMO_ROLES:{id:DemoRole|"brand";label:string;short:string;to:string}[]=[
  {id:"student",label:"Student Demo",short:"Student",to:`${DEMO_ROOT}/student`},
  {id:"staff",label:"Staff Demo",short:"Staff",to:`${DEMO_ROOT}/staff`},
  {id:"admin",label:"Admin Demo",short:"Admin",to:`${DEMO_ROOT}/admin`},
  {id:"brand",label:"Brand Preview",short:"Brand",to:`${DEMO_ROOT}/brand`},
];
const back:NavGroup={label:"Demo",items:[{to:DEMO_ROOT,label:"Demo home",icon:"back",end:true}]};
const R=DEMO_ROOT;

/** Unread notifications for the student view. The count is derived from the shared demo state by the caller. */
export function unreadBadge(unread:number,cap:number){
  return unread>0?{count:badgeText(unread,cap),label:`${unread} unread notification${unread===1?"":"s"}`}:undefined;
}

export function demoNav(role:DemoRole,opts:{unread?:number;cap?:number}={}):NavGroup[]{
  if(role==="student"){
    const b=unreadBadge(opts.unread??0,opts.cap??9);
    return[
      {label:"Shop",items:[{to:`${R}/student`,label:"Home",icon:"home",end:true},{to:`${R}/student/shop`,label:"Shop",icon:"shop"}]},
      {label:"My orders",items:[{to:`${R}/student/reservations`,label:"Reservation History",icon:"receipt"},{to:`${R}/student/notifications`,label:"Notifications",icon:"bell",...(b?{count:b.count,countLabel:b.label}:{})}]},
      back];
  }
  if(role==="staff")return[{label:"Operations",items:[{to:`${R}/staff`,label:"Dashboard",icon:"grid",end:true},{to:`${R}/staff/reservations`,label:"Reservations",icon:"receipt"},{to:`${R}/staff/queue`,label:"Pickup queue",icon:"queue"}]},back];
  return[
    {label:"Overview",items:[{to:`${R}/admin`,label:"Dashboard",icon:"grid",end:true},{to:`${R}/admin/analytics`,label:"Analytics",icon:"chart"},{to:`${R}/admin/reports`,label:"Reports",icon:"file"}]},
    {label:"Catalog",items:[{to:`${R}/admin/products`,label:"Products",icon:"tag"},{to:`${R}/admin/inventory`,label:"Inventory",icon:"box"}]},
    {label:"User management",items:[{to:`${R}/admin/users`,label:"Students",icon:"users",end:true},{to:`${R}/admin/users/history`,label:"Account history",icon:"history"}]},
    {label:"Operations",items:[{to:`${R}/admin/queue`,label:"Pickup queue",icon:"queue"}]},
    {label:"System",items:[{to:`${R}/admin/settings`,label:"Demo policy",icon:"settings"}]},
    back];
}
