import type { SharePointRepository } from "../repositories/repository.js";
export class AnalyticsService {
  constructor(private repo: SharePointRepository) {}
  getSummary() { return { products: this.repo.products.length, activeReservations: this.repo.reservations.filter((r) => !["Completed", "Cancelled", "Expired"].includes(r.status)).length, queueWaiting: this.repo.queues.filter((q) => q.status === "Waiting").length, sales: this.repo.transactions.reduce((sum, item) => sum + item.totalAmount, 0) }; }
  getSalesTrend() { return this.repo.transactions.map((t) => ({ date: t.createdAt.slice(0, 10), amount: t.totalAmount })); }
  getReservationTrend() { return this.repo.reservations.map((r) => ({ date: r.createdAt.slice(0, 10), count: 1 })); }
  getProductDemand() { return this.repo.reservationItems.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity })); }
  getInventoryHealth() { return this.repo.inventory.map((i) => ({ ...i, availableQuantity: i.physicalQuantity - i.reservedQuantity, lowStock: i.physicalQuantity - i.reservedQuantity <= i.reorderLevel })); }
  getQueuePerformance() { return this.getSummary(); }
}

