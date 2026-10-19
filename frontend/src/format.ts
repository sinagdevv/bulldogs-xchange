import type {ReservationStatus} from "./types";

export type Tone="info"|"success"|"warning"|"danger"|"neutral";
const peso=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:0,maximumFractionDigits:2});
const dateTime=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short"});
const dateOnly=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium"});
export const formatPeso=(value:number)=>peso.format(Number.isFinite(value)?value:0);
export const formatDateTime=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?"Not available":dateTime.format(d)};
export const formatDate=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?"Not available":dateOnly.format(d)};
export const errorMessage=(error:unknown)=>error instanceof Error?error.message:"The request could not be completed.";
export const isAbort=(error:unknown)=>error instanceof Error&&error.name==="AbortError";

const tones:Record<string,Tone>={
  "Pending Deposit":"warning","Pending":"warning","Confirmed":"info","Preparing":"info","Ready for Pickup":"success","Completed":"neutral","Cancelled":"danger","Expired":"neutral",
  "Waiting":"warning","Serving":"success","Skipped":"danger","Left":"neutral",
  "pending":"warning","approved":"success","rejected":"danger","suspended":"danger",
  "Healthy":"success","Low Stock":"warning","Out of Stock":"danger",
  "Awaiting payment":"warning","Awaiting verification":"info","Verified":"success","Not verified":"danger",
  "Called":"success","Called to counter":"success","In queue":"warning","Picked up":"neutral","Ready, not in queue":"info",
  "Fast-moving":"success","Slow-moving":"warning","Active":"success","Archived":"neutral",
};
export const statusTone=(value:string):Tone=>tones[value]??"neutral";
export const approvalLabel=(value?:string)=>value?value[0]!.toUpperCase()+value.slice(1):"Approved";

/** Customer-facing explanation of each reservation status. */
export const reservationCopy:Record<ReservationStatus,string>={
  "Pending Deposit":"Reserved temporarily. Submit the required deposit before the deadline; payment still requires staff verification.",
  "Pending":"Received. Staff will review and confirm your reservation.",
  "Confirmed":"Confirmed. Staff will prepare your items for pickup.",
  "Preparing":"Staff are preparing your items at the Xchange counter.",
  "Ready for Pickup":"Ready. Bring your NU ID and join the pickup queue when you arrive on campus.",
  "Completed":"Picked up and paid. Thank you, Bulldog!",
  "Cancelled":"This reservation was cancelled and its stock was released.",
  "Expired":"This reservation expired before pickup and its stock was released.",
};
// The active UI keeps the legacy flow until the deposit policy is approved and enabled.
export const reservationFlow:ReservationStatus[]=["Pending","Pending Deposit","Confirmed","Preparing","Ready for Pickup","Completed"];
export const finalStatuses:ReservationStatus[]=["Completed","Cancelled","Expired"];
export const initials=(name?:string)=>(name??"").split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join("")||"NU";
