export type Role = "Customer" | "Staff" | "Admin";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export type ReservationStatus = "Pending" | "Pending Deposit" | "Confirmed" | "Preparing" | "Ready for Pickup" | "Completed" | "Cancelled" | "Expired";
export type QueueType = "Express" | "Regular";
export type QueueStatus = "Waiting" | "Serving" | "Skipped" | "Completed" | "Left";
export type MovementType = "Reserve" | "Release" | "Sale" | "Adjust" | "Restock";
export type OutboxStatus = "Pending" | "Processing" | "Delivered" | "DeadLetter" | "Superseded";

export interface Category { id: string; title: string; isActive: boolean }
export interface Product { id: string; title: string; categoryId: string; sku: string; description: string; price: number; imageUrl?: string; isFeatured: boolean; isActive: boolean }
export interface ProductVariant { id: string; productId: string; name: string; variantSku: string; isActive: boolean }
export interface Inventory { productVariantId: string; physicalQuantity: number; reservedQuantity: number; reorderLevel: number }
export interface Availability extends Inventory { availableQuantity: number; status: "Out of Stock" | "Low Stock" | "Healthy" }
export interface User { id: string; email: string; displayName: string; schoolId?: string; department?: string; customerType?: string; role: Role; isActive: boolean; approvalStatus?: ApprovalStatus; rejectionReason?: string }
export interface Reservation { id: string; reference: string; customerEmail: string; status: ReservationStatus; expiresAt: string; createdAt: string; updatedAt: string }
export interface ReservationItem { id: string; reservationId: string; productVariantId: string; quantity: number; unitPrice: number }
export interface ReservationLine extends ReservationItem { productId?: string; productName: string; productSku?: string; variantName: string; variantSku?: string; subtotal: number }
export interface ReservationDetails extends Reservation { items: ReservationLine[]; totalAmount: number; queue?: Pick<QueueRecord,"queueNumber"|"status"|"queueType"> }
export interface QueueRecord { id: string; queueNumber: string; customerEmail: string; reservationId?: string; queueType: QueueType; status: QueueStatus; queueDate: string }
export interface Transaction { id: string; reference: string; reservationId?: string; customerEmail: string; staffEmail: string; totalAmount: number; status: string; paymentMethod: string; createdAt: string }
export interface TransactionItem { id: string; transactionId: string; productVariantId: string; quantity: number; unitPrice: number }
export interface InventoryMovement { id: string; productVariantId: string; movementType: MovementType; previousQty: number; changeQty: number; resultingQty: number; relatedRecord?: string; performedBy: string; notes?: string; createdAt: string }
export interface Notification { id: string; recipientEmail: string; type: string; title: string; message: string; deliveryStatus: string; relatedRecord?: string; isRead: boolean; createdAt: string }
export interface AuditLog { id: string; userEmail: string; action: string; entity: string; previousValue?: unknown; newValue?: unknown; details?: string; createdAt: string }
export interface SystemSetting { key: string; value: string; updatedAt: string }

export type ReportType = "EXECUTIVE_SUMMARY" | "SALES" | "TRANSACTIONS" | "RESERVATIONS" | "PRODUCT_DEMAND" | "INVENTORY" | "INVENTORY_MOVEMENTS" | "LOW_STOCK" | "QUEUE" | "AUDIT";
export interface ReportRequest { type: ReportType; from?: string; to?: string; format: "json" | "csv" | "xlsx" | "pdf" }
export interface ReportMetadata { generatedAt: string; generatedBy: string; recordCount: number }
export interface ReportResult { metadata: ReportMetadata; data: unknown[] }
