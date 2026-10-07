import type { AuditLog, Category, Inventory, InventoryMovement, Notification, Product, ProductVariant, QueueRecord, Reservation, ReservationItem, SystemSetting, Transaction, TransactionItem, User } from "../domain/models.js";

export interface SharePointRepository {
  categories: Category[]; products: Product[]; variants: ProductVariant[]; inventory: Inventory[]; users: User[];
  reservations: Reservation[]; reservationItems: ReservationItem[]; queues: QueueRecord[]; transactions: Transaction[];
  transactionItems: TransactionItem[]; movements: InventoryMovement[]; notifications: Notification[]; auditLogs: AuditLog[]; settings: SystemSetting[];
}

