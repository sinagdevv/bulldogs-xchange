import {isActive} from "./engine";
import type {DemoState,ResStatus} from "./types";

export const STATUS_COLORS:Record<ResStatus,string>={"Pending Deposit":"var(--c-pending)",Pending:"var(--c-pending)",Confirmed:"var(--c-confirmed)",Preparing:"var(--c-preparing)","Ready for Pickup":"var(--c-ready)",Completed:"var(--c-completed)",Cancelled:"var(--c-cancelled)",Expired:"var(--c-expired)"};

/** Stock totals for active (non-archived) products only. */
export function inventorySummary(s:DemoState,stockOf:(s:DemoState,id:string)=>{physical:number;reserved:number;available:number;status:string}){
  const live=new Set(s.products.filter(p=>p.active).map(p=>p.id));
  let physical=0,reserved=0,low=0,out=0;
  for(const v of s.variants){if(!live.has(v.productId))continue;const st=stockOf(s,v.id);physical+=st.physical;reserved+=st.reserved;if(st.status==="Low Stock")low++;if(st.status==="Out of Stock")out++}
  return{physical,reserved,available:physical-reserved,low,out,activeReservations:s.reservations.filter(r=>isActive(r.status)).length};
}
