/**
 * Types for the design-preview demo environment.
 * Everything under src/demo is presentation-only: it never imports the API client,
 * the session provider, Supabase, or fetch. All records are fictional.
 */
import type {ReservationStatus} from "../types";
import type {DemoPolicy} from "./policy";

export type ResStatus=ReservationStatus;
export type StudentStatus="pending"|"approved"|"rejected"|"suspended";
export type QueueStatus="Waiting"|"Serving"|"Completed"|"Skipped"|"Left";
export const CATEGORIES=["T-shirts","Polo shirts","Hoodies","Jackets","Uniforms","Caps","Tote bags","Accessories"] as const;
export type Category=typeof CATEGORIES[number];

export interface DemoStudent{id:string;studentId:string;name:string;email:string;program:string;year:number;status:StudentStatus;registeredAt:string;decidedAt?:string;decidedBy?:string;reason?:string}
export interface DemoStaff{id:string;name:string;email:string;role:"Staff"|"Admin"}
export interface DemoProduct{id:string;title:string;category:Category;sku:string;description:string;price:number;featured:boolean;/** false = archived: hidden from the student catalog and not reservable, kept for history. */active:boolean;/** Set to a real image URL later; the placeholder is used while this is empty. */imageUrl?:string}
export interface DemoVariant{id:string;productId:string;name:string;sku:string;physical:number;reorder:number}
export interface HistoryEntry{status:ResStatus;at:string;by:string;note?:string}
/** Down payment status is separate from the reservation status and from pickup status. */
export type DownPaymentStatus="Awaiting payment"|"Awaiting verification"|"Verified"|"Not verified";
export interface DownPayment{amount:number;rate:number;status:DownPaymentStatus;updatedAt:string}
export interface ReservationLine{variantId:string;qty:number;unitPrice:number}
export interface DemoReservation{id:string;reference:string;studentId:string;lines:ReservationLine[];status:ResStatus;createdAt:string;updatedAt:string;expiresAt:string;history:HistoryEntry[];downPayment:DownPayment}
export interface QueueEntry{id:string;number:string;reservationId:string;studentId:string;type:"Regular"|"Express";status:QueueStatus;joinedAt:string;calledAt?:string;doneAt?:string}
export interface DemoNotification{id:string;studentId:string;title:string;message:string;at:string;read:boolean;reservationId?:string}
export type AuditKind="account"|"reservation"|"stock"|"queue"|"product"|"payment"|"settings";
export interface AuditEvent{id:string;at:string;kind:AuditKind;actor:string;message:string;ref?:string}
export type MovementType="Opening count"|"Receive stock"|"Correction"|"Write-off"|"Pickup release";
export interface StockMovement{id:string;at:string;variantId:string;type:MovementType;change:number;resulting:number;actor:string;note?:string}

export interface DemoState{
  version:3;settings:DemoPolicy;
  /** Deterministic demo clock. Advances a few minutes per action, never reads the real clock. */
  now:string;
  students:DemoStudent[];staff:DemoStaff[];products:DemoProduct[];variants:DemoVariant[];
  reservations:DemoReservation[];queue:QueueEntry[];notifications:DemoNotification[];audit:AuditEvent[];movements:StockMovement[];
  counters:{reservation:number;queue:number;audit:number;movement:number;notification:number;product:number;variant:number};
  personas:{student:string;staff:string;admin:string};
}

export interface VariantInput{id?:string;name:string;sku?:string;reorder:number;initialStock?:number}
export interface ProductInput{id?:string;title:string;category:Category;sku:string;description:string;price:number;featured:boolean;imageUrl?:string;variants:VariantInput[]}
export type Action=
  |{type:"reserve";studentId:string;variantId:string;qty:number}
  |{type:"transition";reservationId:string;to:ResStatus;actor:string;role:"student"|"staff"}
  |{type:"joinQueue";reservationId:string;actor:string}
  |{type:"leaveQueue";queueId:string;actor:string}
  |{type:"callNext";actor:string}
  |{type:"skip";queueId:string;actor:string}
  |{type:"release";reservationId:string;actor:string}
  |{type:"decideStudent";studentId:string;decision:"approve"|"reject"|"suspend"|"restore";actor:string;reason?:string}
  |{type:"adjustStock";variantId:string;mode:"receive"|"correct"|"writeoff";qty:number;actor:string;note?:string}
  |{type:"acknowledgePayment";reservationId:string;actor:string}
  |{type:"verifyPayment";reservationId:string;decision:"verify"|"reject";actor:string}
  |{type:"saveProduct";product:ProductInput;actor:string}
  |{type:"archiveProduct";productId:string;archived:boolean;actor:string}
  |{type:"deleteProduct";productId:string;actor:string}
  |{type:"updateSettings";settings:Partial<DemoPolicy>;actor:string}
  |{type:"markRead";studentId:string;notificationId?:string}
  |{type:"reset"};

export interface Result{state:DemoState;ok:boolean;message:string;/** id of a record created by the action, when relevant */created?:string}
