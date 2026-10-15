import type {User} from "../domain/models.js";
import {AppError} from "../lib/errors.js";

export type FinancialCapability="deposit.verify"|"cash.collect"|"cash.reconcile"|"refund.view_assigned"|"refund.approve_routine"|"refund.record_payout"|"refund.confirm_independent"|"refund.approve_exception"|"finance.view_all"|"finance.export"|"finance.manage_policy"|"finance.view_audit";
const staffCapabilities=new Set<FinancialCapability>(["deposit.verify","cash.collect","cash.reconcile","refund.view_assigned","refund.approve_routine","refund.record_payout","refund.confirm_independent"]);

export function requireFinancialCapability(user:User,capability:FinancialCapability){
  if(user.role==="Admin"||user.role==="Staff"&&staffCapabilities.has(capability))return user;
  throw new AppError("FORBIDDEN","You do not have permission for this financial operation.");
}
