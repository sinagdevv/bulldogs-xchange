import {AppError} from "../lib/errors.js";

export type PaymentChannel="GCash"|"Cash";
export type CounterHours={weekday:number;closesAt:string};
const MANILA_MS=8*60*60*1000;

export const gcashDeadline=(createdAt:Date)=>new Date(createdAt.getTime()+24*60*60*1000);

export function operatingDayDeadline(createdAt:Date,days:number,hours:Iterable<CounterHours>,closures:Iterable<string>){
  if(!Number.isInteger(days)||days<1)throw new AppError("CONFIGURATION_ERROR","Operating-day policy is invalid.");
  const byDay=new Map([...hours].map(row=>[row.weekday,row.closesAt])),closed=new Set(closures),cursor=new Date(createdAt.getTime()+MANILA_MS);let fullDays=0;
  for(let checked=0;checked<370&&fullDays<days;checked++){cursor.setUTCDate(cursor.getUTCDate()+1);const date=cursor.toISOString().slice(0,10),closing=byDay.get(cursor.getUTCDay());if(closing&&!closed.has(date)){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(closing))throw new AppError("CONFIGURATION_ERROR","Counter operating hours are invalid.");fullDays++;if(fullDays===days){const[hour,minute]=closing.split(":").map(Number);return new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth(),cursor.getUTCDate(),hour!-8,minute))}}}
  throw new AppError("CONFIGURATION_ERROR","Counter operating calendar is unavailable.");
}
export const cashDeadline=(createdAt:Date,hours:Iterable<CounterHours>,closures:Iterable<string>)=>operatingDayDeadline(createdAt,2,hours,closures);
