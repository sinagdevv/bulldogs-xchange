const TZ="Asia/Manila";
const dt=new Intl.DateTimeFormat("en-PH",{timeZone:TZ,month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const d=new Intl.DateTimeFormat("en-PH",{timeZone:TZ,month:"short",day:"numeric"});
const day=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"});
export const when=(iso:string)=>dt.format(new Date(iso));
export const shortDate=(iso:string)=>d.format(new Date(iso));
/** yyyy-mm-dd in Manila time, used for per-day grouping. */
export const dayKey=(iso:string)=>day.format(new Date(iso));
export function ago(iso:string,now:string){
  const m=Math.max(0,Math.round((Date.parse(now)-Date.parse(iso))/60000));
  if(m<1)return "just now";if(m<60)return `${m} min ago`;const h=Math.round(m/60);if(h<24)return `${h} h ago`;const days=Math.round(h/24);return `${days} d ago`;
}
export const initialsOf=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]!.toUpperCase()).join("");
export const firstName=(name:string)=>name.split(/\s+/)[0]??name;
const peso2=new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2,maximumFractionDigits:2});
/** Peso amount with centavos, used for down payment and balance figures. */
export const peso=(n:number)=>peso2.format(Number.isFinite(n)?n:0);
const num=new Intl.NumberFormat("en-PH");
export const count=(n:number)=>num.format(n);
const dateLong=new Intl.DateTimeFormat("en-PH",{timeZone:TZ,year:"numeric",month:"short",day:"numeric"});
const dateTime=new Intl.DateTimeFormat("en-PH",{timeZone:TZ,year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
export const longDate=(iso:string)=>dateLong.format(new Date(iso));
export const dateAndTime=(iso:string)=>dateTime.format(new Date(iso));
/** Formats a yyyy-mm-dd day key, e.g. "Oct 9, 2026". */
export const dayLabel=(key:string)=>dateLong.format(new Date(`${key}T12:00:00+08:00`));
export const dayShort=(key:string)=>d.format(new Date(`${key}T12:00:00+08:00`));
export const hourKey=(iso:string)=>Number(new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",hourCycle:"h23"}).format(new Date(iso)));
