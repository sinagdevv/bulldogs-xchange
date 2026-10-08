export type Role="Customer"|"Staff"|"Admin";
export type ReservationStatus="Pending"|"Confirmed"|"Preparing"|"Ready for Pickup"|"Completed"|"Cancelled"|"Expired";
export type QueueStatus="Waiting"|"Serving"|"Skipped"|"Completed"|"Left";
export interface User{id:string;email:string;displayName:string;role:Role;department?:string;customerType?:string;schoolId?:string;isActive?:boolean}
export interface Category{id:string;title:string;isActive:boolean}
export interface Product{id:string;title:string;categoryId:string;sku:string;description:string;price:number;imageUrl?:string;isFeatured:boolean;isActive:boolean}
export interface Variant{id:string;productId:string;name:string;variantSku:string;isActive:boolean}
export interface Availability{productVariantId:string;physicalQuantity:number;reservedQuantity:number;reorderLevel:number;availableQuantity:number;status:"Out of Stock"|"Low Stock"|"Healthy"}
export interface Reservation{id:string;reference:string;customerEmail:string;status:ReservationStatus;expiresAt:string;createdAt:string;updatedAt:string}
export interface QueueRecord{id:string;queueNumber:string;customerEmail:string;reservationId?:string;queueType:"Express"|"Regular";status:QueueStatus;queueDate:string}
export interface QueueSummary{waiting:number;serving:string[]}
export interface Notification{id:string;recipientEmail:string;type:string;title:string;message:string;deliveryStatus:string;relatedRecord?:string;isRead:boolean;createdAt:string}
export interface Session{authenticated:boolean;user:User|null;onboardingRequired?:boolean}
export interface ApiSuccess<T>{success:true;data:T;reference:string|null;message:string}
export interface ApiFailure{success:false;error:{code:string;message:string}}
export interface CatalogQuery{search?:string;category?:string;sort?:"title"|"price"|"-price";featured?:boolean}
