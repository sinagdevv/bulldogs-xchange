import type { AuditLog, Category, Inventory, InventoryMovement, Notification, Product, ProductVariant, QueueRecord, Reservation, ReservationItem, SystemSetting, Transaction, TransactionItem, User } from "../domain/models.js";
import type { SharePointRepository } from "./repository.js";
const now = "2026-01-01T08:00:00.000Z";
export class MockSharePointRepository implements SharePointRepository {
  categories: Category[] = [{ id: "cat-1", title: "Apparel", isActive: true }];
  products: Product[] = [{ id: "prod-1", title: "NU Bulldogs Shirt", categoryId: "cat-1", sku: "MRC-SHIRT", description: "NU Bulldogs merchandise shirt", price: 299, imageUrl: "/images/shirt.jpg", isFeatured: true, isActive: true }];
  variants: ProductVariant[] = [{ id: "var-1", productId: "prod-1", name: "Medium", variantSku: "MRC-SHIRT-M", isActive: true }];
  inventory: Inventory[] = [{ productVariantId: "var-1", physicalQuantity: 20, reservedQuantity: 2, reorderLevel: 5 }];
  users: User[] = [{ id: "user-1", email: "customer@example.test", displayName: "Test Customer", schoolId: "2026-0001", role: "Customer", isActive: true }, { id: "user-2", email: "staff@example.test", displayName: "Test Staff", role: "Staff", isActive: true }, { id: "user-3", email: "admin@example.test", displayName: "Test Admin", role: "Admin", isActive: true }];
  reservations: Reservation[] = [{ id: "res-1", reference: "BX-2026-0001", customerEmail: "customer@example.test", status: "Confirmed", expiresAt: "2026-12-31T00:00:00.000Z", createdAt: now, updatedAt: now }];
  reservationItems: ReservationItem[] = [{ id: "ri-1", reservationId: "res-1", productVariantId: "var-1", quantity: 2, unitPrice: 299 }];
  queues: QueueRecord[] = [{ id: "queue-1", queueNumber: "R-001", customerEmail: "customer@example.test", reservationId: "res-1", queueType: "Regular", status: "Waiting", queueDate: now }];
  transactions: Transaction[] = []; transactionItems: TransactionItem[] = []; movements: InventoryMovement[] = [];
  notifications: Notification[] = [{ id: "note-1", recipientEmail: "customer@example.test", type: "reservation", title: "Reservation confirmed", message: "Your campus pickup reservation is confirmed.", deliveryStatus: "sent", relatedRecord: "res-1", isRead: false, createdAt: now }];
  auditLogs: AuditLog[] = []; settings: SystemSetting[] = [{ key: "ReservationExpiryDays", value: "3", updatedAt: now }, { key: "LowStockDefault", value: "5", updatedAt: now }];
  async getCategories() { return this.categories; } async getProducts() { return this.products; } async getProductById(id: string) { return this.products.find((x) => x.id === id); }
  async getVariants() { return this.variants; } async getVariantsByProductId(id: string) { return this.variants.filter((x) => x.productId === id); }
  async getInventory() { return this.inventory; } async getInventoryByVariantId(id: string) { return this.inventory.find((x) => x.productVariantId === id); } async getInventoryByProductId(id: string) { const variants = new Set(this.variants.filter((x) => x.productId === id).map((x) => x.id)); return this.inventory.filter((x) => variants.has(x.productVariantId)); }
  async getUsers() { return this.users; } async getUserByEmail(email: string) { return this.users.find((x) => x.email.toLowerCase() === email.toLowerCase()); } async getUserBySchoolId(id: string) { return this.users.find((x) => x.schoolId === id); } async getUserByAuthSubject(subject:string){return this.users.find(x=>subject===`subject:${x.email}`||subject===`development:${x.email}`);}
  async getReservations() { return this.reservations; } async getReservationById(id: string) { return this.reservations.find((x) => x.id === id); } async getReservationsByCustomerEmail(email: string) { return this.reservations.filter((x) => x.customerEmail.toLowerCase() === email.toLowerCase()); }
  async getReservationItems() { return this.reservationItems; } async getReservationItemsByReservationId(id: string) { return this.reservationItems.filter((x) => x.reservationId === id); }
  async getQueues() { return this.queues; } async getQueueById(id: string) { return this.queues.find((x) => x.id === id); } async getQueuesByCustomerEmail(email: string) { return this.queues.filter((x) => x.customerEmail.toLowerCase() === email.toLowerCase()); }
  async getTransactions() { return this.transactions; } async getTransactionById(id: string) { return this.transactions.find((x) => x.id === id); } async getTransactionItems() { return this.transactionItems; }
  async getInventoryMovements() { return this.movements; } async getNotifications(email?: string) { return email ? this.notifications.filter((x) => x.recipientEmail.toLowerCase() === email.toLowerCase()) : this.notifications; }
  async markNotificationRead(id: string, email: string) { const item=this.notifications.find((x)=>x.id===id&&x.recipientEmail.toLowerCase()===email.toLowerCase()); if(!item)return false; item.isRead=true; return true; }
  async markAllNotificationsRead(email: string) { const items=this.notifications.filter((x)=>x.recipientEmail.toLowerCase()===email.toLowerCase()&&!x.isRead); items.forEach((x)=>x.isRead=true); return items.length; }
  async getAuditLogs() { return this.auditLogs; } async getSystemSettings() { return this.settings; }
}
export const createMockRepository = () => new MockSharePointRepository();
