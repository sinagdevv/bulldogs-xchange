import type { AuditLog, Category, Inventory, InventoryMovement, Notification, Product, ProductVariant, QueueRecord, Reservation, ReservationItem, SystemSetting, Transaction, TransactionItem, User } from "../domain/models.js";
export interface SharePointRepository {
  getCategories(): Promise<Category[]>; getProducts(): Promise<Product[]>; getProductById(id: string): Promise<Product | undefined>;
  getVariants(): Promise<ProductVariant[]>; getVariantsByProductId(productId: string): Promise<ProductVariant[]>;
  getInventory(): Promise<Inventory[]>; getInventoryByVariantId(variantId: string): Promise<Inventory | undefined>; getInventoryByProductId(productId: string): Promise<Inventory[]>;
  getUsers(): Promise<User[]>; getUserByEmail(email: string): Promise<User | undefined>; getUserBySchoolId(schoolId: string): Promise<User | undefined>; getUserByAuthSubject(subject: string): Promise<User | undefined>;
  getReservations(): Promise<Reservation[]>; getReservationById(id: string): Promise<Reservation | undefined>; getReservationsByCustomerEmail(email: string): Promise<Reservation[]>;
  getReservationItems(): Promise<ReservationItem[]>; getReservationItemsByReservationId(reservationId: string): Promise<ReservationItem[]>;
  getQueues(): Promise<QueueRecord[]>; getQueueById(id: string): Promise<QueueRecord | undefined>; getQueuesByCustomerEmail(email: string): Promise<QueueRecord[]>;
  getTransactions(): Promise<Transaction[]>; getTransactionById(id: string): Promise<Transaction | undefined>; getTransactionItems(): Promise<TransactionItem[]>;
  getInventoryMovements(): Promise<InventoryMovement[]>; getNotifications(recipientEmail?: string): Promise<Notification[]>; markNotificationRead(id: string, recipientEmail: string): Promise<boolean>; markAllNotificationsRead(recipientEmail: string): Promise<number>; getAuditLogs(): Promise<AuditLog[]>; getSystemSettings(): Promise<SystemSetting[]>;
}
