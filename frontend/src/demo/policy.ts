/**
 * Central, configurable demo policy. These values are PREVIEW assumptions, not approved business rules.
 * They live in the demo state (see Admin > Demo policy) so they can be revised during a presentation.
 */
export interface DemoPolicy{
  /** Share of the reservation subtotal required as a down payment (0.2 = 20%). */
  downPaymentRate:number;
  /** Maximum units of one item (one size) in a single reservation. */
  maxUnitsPerItem:number;
  /** Notification counts above this value are shown as "N+". */
  notificationBadgeCap:number;
}
export const DEFAULT_POLICY:DemoPolicy={downPaymentRate:0.2,maxUnitsPerItem:3,notificationBadgeCap:9};
export const POLICY_DISCLAIMER="Preview policy for the demo only. This is not an approved business rule, and no payment is processed.";

/** Down payment in pesos, rounded to the centavo. */
export const downPaymentFor=(subtotal:number,rate:number)=>Math.round(subtotal*rate*100)/100;
export const balanceFor=(subtotal:number,downPayment:number)=>Math.round((subtotal-downPayment)*100)/100;
export const percentLabel=(rate:number)=>`${Math.round(rate*1000)/10}%`;
export const badgeText=(count:number,cap:number)=>count>cap?`${cap}+`:String(count);
export function sanitizePolicy(p:Partial<DemoPolicy>,base:DemoPolicy):{ok:true;policy:DemoPolicy}|{ok:false;message:string}{
  const next={...base,...p};
  if(!(next.downPaymentRate>=0&&next.downPaymentRate<=1))return{ok:false,message:"Down payment must be between 0% and 100%."};
  if(!Number.isInteger(next.maxUnitsPerItem)||next.maxUnitsPerItem<1||next.maxUnitsPerItem>20)return{ok:false,message:"The per-item limit must be a whole number from 1 to 20."};
  if(!Number.isInteger(next.notificationBadgeCap)||next.notificationBadgeCap<1||next.notificationBadgeCap>99)return{ok:false,message:"The badge cap must be a whole number from 1 to 99."};
  return{ok:true,policy:next};
}
