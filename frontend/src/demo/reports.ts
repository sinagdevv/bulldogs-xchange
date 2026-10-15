/* Pure reporting functions over the demo state. Every chart, table, CSV export and printed report is built from these,
   so a selected date range always means the same thing everywhere. All figures are simulated demo data. */
import {dayKey,dayLabel,dayShort,hourKey} from "./format";
import {pickupStatusOf,productOf,unitsOf,totalOf,variantOf,UNPICKED_STATUSES} from "./engine";
import type {Cell} from "./csv";
import type {DemoReservation,DemoState,ResStatus} from "./types";

/* ---------------- Date ranges ---------------- */
export type RangePreset="today"|"7d"|"30d"|"custom";
export interface DateRange{preset:RangePreset;/** yyyy-mm-dd, Manila time, inclusive */from:string;to:string}
export const PRESETS:{id:RangePreset;label:string}[]=[{id:"today",label:"Today"},{id:"7d",label:"Last 7 days"},{id:"30d",label:"Last 30 days"},{id:"custom",label:"Custom range"}];
const KEY_RE=/^\d{4}-\d{2}-\d{2}$/;
export const addDays=(key:string,n:number)=>{const d=new Date(`${key}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const daysBetween=(a:string,b:string)=>Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000)+1;
const validKey=(k?:string|null):k is string=>!!k&&KEY_RE.test(k)&&!Number.isNaN(Date.parse(`${k}T00:00:00Z`));

export function resolveRange(preset:RangePreset,nowIso:string,custom?:{from?:string|null;to?:string|null}):DateRange{
  const today=dayKey(nowIso);
  if(preset==="today")return{preset,from:today,to:today};
  if(preset==="30d")return{preset,from:addDays(today,-29),to:today};
  if(preset==="custom"&&validKey(custom?.from)&&validKey(custom?.to)){
    let from=custom!.from!,to=custom!.to!;if(from>to)[from,to]=[to,from];
    if(daysBetween(from,to)>366)from=addDays(to,-365);
    return{preset,from,to};
  }
  return{preset:"7d",from:addDays(today,-6),to:today};
}
export const rangeDays=(r:DateRange)=>Array.from({length:daysBetween(r.from,r.to)},(_,i)=>addDays(r.from,i));
export const rangeLabel=(r:DateRange)=>r.from===r.to?dayLabel(r.from):`${dayLabel(r.from)} to ${dayLabel(r.to)}`;
export const previousRange=(r:DateRange):DateRange=>{const n=daysBetween(r.from,r.to);return{preset:"custom",from:addDays(r.from,-n),to:addDays(r.from,-1)}};
export const inRange=(iso:string,r:DateRange)=>{const k=dayKey(iso);return k>=r.from&&k<=r.to};
/** Reads ?range=today|7d|30d|custom&from=&to= so Analytics, Reports and exports share one range. */
export function rangeFromParams(params:URLSearchParams,nowIso:string):DateRange{
  const p=params.get("range");
  return resolveRange(p==="today"||p==="7d"||p==="30d"||p==="custom"?p:"7d",nowIso,{from:params.get("from"),to:params.get("to")});
}
export function rangeToParams(r:DateRange):Record<string,string>{return r.preset==="custom"?{range:"custom",from:r.from,to:r.to}:{range:r.preset}}

/* ---------------- Series ---------------- */
export interface Point{label:string;value:number}
const completedAt=(x:DemoReservation)=>x.status==="Completed"?x.updatedAt:undefined;
const reservedIn=(s:DemoState,r:DateRange)=>s.reservations.filter(x=>inRange(x.createdAt,r));
const HOURS=Array.from({length:12},(_,i)=>i+7);
const hourLabel=(h:number)=>`${h%12===0?12:h%12} ${h<12?"AM":"PM"}`;
function series(s:DemoState,r:DateRange,dates:(x:DemoReservation)=>string|undefined):Point[]{
  const single=r.from===r.to;
  if(single){
    const n=new Map<number,number>(HOURS.map(h=>[h,0]));
    for(const x of s.reservations){const at=dates(x);if(!at||!inRange(at,r))continue;const h=Math.min(18,Math.max(7,hourKey(at)));n.set(h,(n.get(h)??0)+1)}
    return HOURS.map(h=>({label:hourLabel(h),value:n.get(h)!}));
  }
  const days=rangeDays(r),n=new Map(days.map(d=>[d,0]));
  for(const x of s.reservations){const at=dates(x);if(!at)continue;const k=dayKey(at);if(n.has(k))n.set(k,n.get(k)!+1)}
  return days.map(d=>({label:dayShort(d),value:n.get(d)!}));
}
export const reservationSeries=(s:DemoState,r:DateRange)=>series(s,r,x=>x.createdAt);
export const pickupSeries=(s:DemoState,r:DateRange)=>series(s,r,completedAt);

/* ---------------- Status distribution ---------------- */
export const STATUS_ORDER:ResStatus[]=["Pending","Confirmed","Preparing","Ready for Pickup","Completed","Cancelled","Expired"];
export function statusCounts(s:DemoState,r:DateRange){
  const rows=reservedIn(s,r);return STATUS_ORDER.map(status=>({status,count:rows.filter(x=>x.status===status).length}));
}

/* ---------------- Summary ---------------- */
export function summary(s:DemoState,r:DateRange){
  const made=reservedIn(s,r),picked=s.reservations.filter(x=>{const a=completedAt(x);return a&&inRange(a,r)});
  const live=s.reservations.filter(x=>UNPICKED_STATUSES.includes(x.status));
  return{
    reservations:made.length,unitsReserved:made.filter(x=>x.status!=="Cancelled"&&x.status!=="Expired").reduce((n,x)=>n+unitsOf(x),0),
    completedPickups:picked.length,cancelledOrExpired:made.filter(x=>x.status==="Cancelled"||x.status==="Expired").length,
    unpickedUnits:live.reduce((n,x)=>n+unitsOf(x),0),unpickedReservations:live.length,
  };
}

/* ---------------- Merchandise movement ----------------
   Metric: UNITS RESERVED in the period (reservations created in the range, excluding cancelled and expired).
   Reservations are not sales. "Units picked up" is shown separately and counts completed pickups released in the range. */
export const FAST_N=5,SLOW_N=5;
export type MovementClass="Fast-moving"|"Slow-moving"|"Steady";
export interface MovementRow{productId:string;item:string;category:string;unitsReserved:number;unitsPickedUp:number;previous:number;delta:number;trend:string;rank:number;movement:MovementClass;active:boolean}
const counted=(x:DemoReservation)=>x.status!=="Cancelled"&&x.status!=="Expired";
function unitsByProduct(s:DemoState,pred:(x:DemoReservation)=>boolean){
  const n=new Map<string,number>();
  for(const x of s.reservations)if(pred(x))for(const l of x.lines){const v=variantOf(s,l.variantId);if(v)n.set(v.productId,(n.get(v.productId)??0)+l.qty)}
  return n;
}
export function trendOf(now:number,before:number){
  if(now===before)return before===0?"No activity":"No change";
  if(before===0)return `New, ${now}`;
  return now>before?`Up ${now-before}`:`Down ${before-now}`;
}
export function movement(s:DemoState,r:DateRange):MovementRow[]{
  const cur=unitsByProduct(s,x=>counted(x)&&inRange(x.createdAt,r)),prev=unitsByProduct(s,x=>counted(x)&&inRange(x.createdAt,previousRange(r)));
  const picked=unitsByProduct(s,x=>{const a=completedAt(x);return !!a&&inRange(a,r)});
  const rows=s.products.filter(p=>p.active||(cur.get(p.id)??0)>0||(picked.get(p.id)??0)>0).map(p=>{
    const u=cur.get(p.id)??0,b=prev.get(p.id)??0;
    return{productId:p.id,item:p.title,category:p.category,unitsReserved:u,unitsPickedUp:picked.get(p.id)??0,previous:b,delta:u-b,trend:trendOf(u,b),rank:0,movement:"Steady" as MovementClass,active:p.active};
  }).sort((a,b)=>b.unitsReserved-a.unitsReserved||b.unitsPickedUp-a.unitsPickedUp||a.item.localeCompare(b.item));
  rows.forEach((x,i)=>{x.rank=i+1});
  const fast=rows.filter(x=>x.unitsReserved>0).slice(0,FAST_N);fast.forEach(x=>{x.movement="Fast-moving"});
  const slow=[...rows].filter(x=>x.active&&x.movement!=="Fast-moving").sort((a,b)=>a.unitsReserved-b.unitsReserved||a.item.localeCompare(b.item)).slice(0,SLOW_N);slow.forEach(x=>{x.movement="Slow-moving"});
  return rows;
}
export const fastMoving=(rows:MovementRow[])=>rows.filter(x=>x.movement==="Fast-moving");
export const slowMoving=(rows:MovementRow[])=>rows.filter(x=>x.movement==="Slow-moving").sort((a,b)=>a.unitsReserved-b.unitsReserved||a.item.localeCompare(b.item));

/* ---------------- Datasets (tables, CSV, printed reports) ---------------- */
export interface Dataset{id:string;title:string;note:string;headers:string[];rows:Cell[][];totals?:Cell[]}
export const REPORT_TYPES:{id:string;label:string;description:string}[]=[
  {id:"summary",label:"Reservation summary",description:"Daily reservations, units, completed pickups, and cancellations."},
  {id:"movement",label:"Merchandise movement",description:"Fast-moving and slow-moving items by units reserved."},
  {id:"status",label:"Reservation status",description:"How reservations in the period are distributed by status."},
  {id:"ledger",label:"Reservation ledger",description:"Every reservation in the period with payment and pickup status."},
  {id:"unpicked",label:"Unpicked items",description:"Units reserved and still awaiting pickup, by item and size."},
];
export function dataset(s:DemoState,r:DateRange,id:string):Dataset{
  const sumRow=(rows:Cell[][],i:number)=>rows.reduce((n,x)=>n+(typeof x[i]==="number"?x[i] as number:0),0);
  if(id==="movement"){
    const rows=movement(s,r).map(x=>[x.rank,x.item,x.category,x.unitsReserved,x.unitsPickedUp,x.trend,x.movement]);
    return{id,title:"Merchandise movement",note:"Movement metric: units reserved in the period (cancelled and expired excluded). Reservations are not sales.",headers:["Rank","Item","Category","Units reserved","Units picked up","Trend vs previous period","Movement"],rows,totals:["","Total","",sumRow(rows,3),sumRow(rows,4),"",""]};
  }
  if(id==="status"){
    const c=statusCounts(s,r),total=c.reduce((n,x)=>n+x.count,0),rows=c.map(x=>[x.status,x.count,total?Math.round(x.count/total*1000)/10:0]);
    return{id,title:"Reservation status",note:"Reservations created in the period, grouped by their current status.",headers:["Status","Reservations","Share (%)"],rows,totals:["Total",total,total?100:0]};
  }
  if(id==="ledger"){
    const rows=reservedIn(s,r).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).map(x=>{
      const st=s.students.find(y=>y.id===x.studentId);
      return[x.reference,dayKey(x.createdAt),st?.studentId??"",st?.name??"",x.lines.map(l=>{const v=variantOf(s,l.variantId);return `${productOf(s,v?.productId??"")?.title??"Item"}${v&&v.name!=="Standard"?` (${v.name})`:""} x${l.qty}`}).join("; "),unitsOf(x),totalOf(x),x.downPayment.amount,x.downPayment.status,x.status,pickupStatusOf(s,x)] as Cell[];
    });
    return{id,title:"Reservation ledger",note:"Reservation status, down payment status, and pickup status are separate fields. Down payments are simulated.",headers:["Reference","Date","Student ID","Student","Items","Units","Subtotal (PHP)","Down payment (PHP)","Down payment status","Reservation status","Pickup status"],rows,totals:["Total","","","","",sumRow(rows,5),sumRow(rows,6),sumRow(rows,7),"","",""]};
  }
  if(id==="unpicked"){
    const m=new Map<string,{item:string;size:string;units:number;res:number;oldest:string}>();
    for(const x of s.reservations)if(UNPICKED_STATUSES.includes(x.status))for(const l of x.lines){
      const v=variantOf(s,l.variantId);if(!v)continue;const p=productOf(s,v.productId);
      const e=m.get(v.id)??{item:p?.title??"Item",size:v.name,units:0,res:0,oldest:x.createdAt};
      e.units+=l.qty;e.res+=1;if(x.createdAt<e.oldest)e.oldest=x.createdAt;m.set(v.id,e);
    }
    const rows=[...m.values()].sort((a,b)=>b.units-a.units||a.item.localeCompare(b.item)||a.size.localeCompare(b.size)).map(e=>[e.item,e.size,e.units,e.res,dayKey(e.oldest)] as Cell[]);
    return{id,title:"Unpicked items",note:"Snapshot of units in reservations that are pending, confirmed, preparing, or ready and not yet picked up. Not limited to the date range.",headers:["Item","Size","Units awaiting pickup","Reservations","Oldest reservation"],rows,totals:["Total","",sumRow(rows,2),sumRow(rows,3),""]};
  }
  const days=rangeDays(r),single=r.from===r.to;
  const made=reservedIn(s,r);
  const rows=(single?[r.from]:days).map(d=>{
    const inDay=made.filter(x=>dayKey(x.createdAt)===d);
    return[dayLabel(d),inDay.length,inDay.filter(counted).reduce((n,x)=>n+unitsOf(x),0),s.reservations.filter(x=>{const a=completedAt(x);return !!a&&dayKey(a)===d}).length,inDay.filter(x=>!counted(x)).length] as Cell[];
  });
  return{id:"summary",title:"Reservation summary",note:"Reservations are counted on the day they were created. Completed pickups are counted on the day they were released.",headers:["Date","Reservations created","Units reserved","Completed pickups","Cancelled or expired"],rows,totals:["Total",sumRow(rows,1),sumRow(rows,2),sumRow(rows,3),sumRow(rows,4)]};
}
export const datasetCsv=(d:Dataset)=>({headers:d.headers,rows:d.totals?[...d.rows,d.totals]:d.rows});
export const csvName=(id:string,r:DateRange)=>`bulldogs-xchange-demo-${id}-${r.from}_to_${r.to}.csv`;

/* ---------------- Operational date filter (queue and reservation lists) ---------------- */
export interface DateFilterValue{preset:"all"|"today"|"7d"|"custom";from:string;to:string}
export const ALL_DATES:DateFilterValue={preset:"all",from:"",to:""};
export const isAllDates=(f:DateFilterValue)=>f.preset==="all";
export function filterRange(f:DateFilterValue,nowIso:string):DateRange|null{
  if(f.preset==="all")return null;
  return resolveRange(f.preset,nowIso,{from:f.from,to:f.to});
}
/** A row with no date for the chosen basis never matches an active date filter. */
export function matchesDate(f:DateFilterValue,iso:string|undefined,nowIso:string){
  const r=filterRange(f,nowIso);if(!r)return true;
  return !!iso&&inRange(iso,r);
}
