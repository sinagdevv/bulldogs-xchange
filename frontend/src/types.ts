export type Role="Customer"|"Staff"|"Admin";
export type ReservationStatus="Pending"|"Pending Deposit"|"Confirmed"|"Preparing"|"Ready for Pickup"|"Completed"|"Cancelled"|"Expired";
export type QueueStatus="Waiting"|"Serving"|"Skipped"|"Completed"|"Left";
export type ApprovalStatus="pending"|"approved"|"rejected"|"suspended";
export interface User{id:string;email:string;displayName:string;role:Role;department?:string;customerType?:string;schoolId?:string;isActive?:boolean;approvalStatus?:ApprovalStatus;rejectionReason?:string}
export interface Category{id:string;title:string;isActive:boolean}
export interface Product{id:string;title:string;categoryId:string;sku:string;description:string;price:number;imageUrl?:string;isFeatured:boolean;isActive:boolean;supplemental?:boolean}
export interface Variant{id:string;productId:string;name:string;variantSku:string;isActive:boolean}
export interface Availability{productVariantId:string;physicalQuantity:number;reservedQuantity:number;reorderLevel:number;availableQuantity:number;status:"Out of Stock"|"Low Stock"|"Healthy"}
export interface Reservation{id:string;reference:string;customerEmail:string;status:ReservationStatus;expiresAt:string;createdAt:string;updatedAt:string}
export interface ReservationLine{id:string;reservationId:string;productVariantId:string;productId?:string;productName:string;productSku?:string;variantName:string;variantSku?:string;quantity:number;unitPrice:number;subtotal:number}
export interface ReservationDetails extends Reservation{items:ReservationLine[];totalAmount:number;queue?:Pick<QueueRecord,"queueNumber"|"status"|"queueType">}
export interface QueueRecord{id:string;queueNumber:string;customerEmail:string;reservationId?:string;queueType:"Express"|"Regular";status:QueueStatus;queueDate:string}
export interface QueueSummary{waiting:number;serving:string[]}
export interface Notification{id:string;recipientEmail:string;type:string;title:string;message:string;deliveryStatus:string;relatedRecord?:string;isRead:boolean;createdAt:string}
export interface ApprovalHistory{id:string;userId:string;action:ApprovalStatus;reason?:string|null;createdAt:string;actingAdminUserId?:string|null;actingAdminName?:string|null}
export type DepositStatus="Awaiting Payment"|"Submitted for Verification"|"Verified"|"Rejected"|"Refund Pending"|"Refund Approved"|"Refund Held"|"Payout Recorded"|"Refund Completed"|"Refunded"|"Refund Failed";
export interface DepositDetails{id:string;reservationId:string;expectedAmount:number;amountReceived:number;remainingBalance:number;status:DepositStatus;reservationStatus:ReservationStatus;paymentMethod:string;depositDeadlineAt?:string;pickupDeadlineAt?:string;refundStatus?:DepositStatus;paymentReference?:string;submittedAt?:string;verifiedAt?:string}
export interface PaymentEvidence{fileName:string;contentType:"image/jpeg"|"image/png"|"application/pdf";size:number;sha256:string;storageObjectId:string}
export interface FinancialRecord{id:string;reservationReference:string;status:DepositStatus;paymentMethod?:string;expectedAmount?:number;amountReceived?:number;refundAmount?:number;depositDeadlineAt?:string;pickupDeadlineAt?:string}
export interface FinancialOverview{completedSales:number;pickupCollections:number;completedTransactions:number;depositLiability:number;verifiedDeposits:number;completedRefunds:number;exceptionCount:number;definitions:Record<string,string>}
export interface Session{authenticated:boolean;user:User|null;onboardingRequired?:boolean;registrationPending?:boolean}
export interface ApiSuccess<T>{success:true;data:T;reference:string|null;message:string}
export interface ApiFailure{success:false;error:{code:string;message:string}}
export interface CatalogQuery{search?:string;category?:string;sort?:"title"|"price"|"-price";featured?:boolean}
export interface OperationsSummary{products:number;activeReservations:number;queueWaiting:number;sales:number}
export interface InventoryHealth{productVariantId:string;physicalQuantity:number;reservedQuantity:number;reorderLevel:number;availableQuantity:number;lowStock:boolean}
export interface InventoryMovement{id:string;productVariantId:string;movementType:string;previousQty:number;changeQty:number;resultingQty:number;relatedRecord?:string;performedBy:string;notes?:string;createdAt:string}
export interface Transaction{id:string;reference:string;reservationId?:string;customerEmail:string;staffEmail:string;totalAmount:number;status:string;paymentMethod:string;createdAt:string}
export interface AuditLog{id:string;userEmail:string;action:string;entity:string;details?:string;createdAt:string}
export interface SystemSetting{key:string;value:string;updatedAt:string}
export interface Page<T>{items:T[];page:number;pageSize:number;total:number;totalPages:number}
export interface ReportMetrics{range:{startDate:string|null;endDate:string|null;timeZone:"UTC";endInclusive:true};totals:{totalReservations:number;activeReservations:number;completedPickups:number;recordedSales:number};reservationsByStatus:{status:ReservationStatus;count:number}[];productMovement:{productId:string;productName:string;unitsReserved:number;unitsPickedUp:number}[];inventory:{physicalUnits:number;unpickedUnits:number;availableUnits:number};queue:{queueEntries:number;completedQueueEntries:number};definitions:Record<string,string>}
