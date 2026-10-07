import type { SharePointRepository } from "./repository.js";

const now = "2026-01-01T08:00:00.000Z";
export function createMockRepository(): SharePointRepository {
  return {
    categories: [{ id: "cat-1", title: "Apparel", isActive: true }],
    products: [{ id: "prod-1", title: "Bulldogs Shirt", categoryId: "cat-1", sku: "BX-SHIRT", description: "Official campus merchandise", price: 350, imageUrl: "/images/shirt.jpg", isFeatured: true, isActive: true }],
    variants: [{ id: "var-1", productId: "prod-1", name: "Medium", variantSku: "BX-SHIRT-M", isActive: true }],
    inventory: [{ productVariantId: "var-1", physicalQuantity: 20, reservedQuantity: 2, reorderLevel: 5 }],
    users: [
      { id: "user-1", email: "customer@example.test", displayName: "Test Customer", role: "Customer", isActive: true },
      { id: "user-2", email: "staff@example.test", displayName: "Test Staff", role: "Staff", isActive: true },
      { id: "user-3", email: "admin@example.test", displayName: "Test Admin", role: "Admin", isActive: true }
    ],
    reservations: [{ id: "res-1", reference: "BX-2026-0001", customerEmail: "customer@example.test", status: "Confirmed", expiresAt: "2026-12-31T00:00:00.000Z", createdAt: now, updatedAt: now }],
    reservationItems: [{ id: "ri-1", reservationId: "res-1", productVariantId: "var-1", quantity: 2, unitPrice: 350 }],
    queues: [{ id: "queue-1", queueNumber: "R-001", customerEmail: "customer@example.test", reservationId: "res-1", queueType: "Regular", status: "Waiting", queueDate: now }],
    transactions: [], transactionItems: [], movements: [],
    notifications: [{ id: "note-1", recipientEmail: "customer@example.test", type: "reservation", title: "Reservation confirmed", message: "Your campus pickup reservation is confirmed.", deliveryStatus: "sent", relatedRecord: "res-1", isRead: false, createdAt: now }],
    auditLogs: [],
    settings: [{ key: "ReservationExpiryDays", value: "3", updatedAt: now }, { key: "LowStockDefault", value: "5", updatedAt: now }]
  };
}

