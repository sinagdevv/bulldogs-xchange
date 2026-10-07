import type { SharePointRepository } from "../repositories/repository.js";
export class AnalyticsService {
  constructor(private repo: SharePointRepository) {}
  async getSummary() { const [products, reservations, queues, transactions] = await Promise.all([this.repo.getProducts(), this.repo.getReservations(), this.repo.getQueues(), this.repo.getTransactions()]); return { products: products.length, activeReservations: reservations.filter((r) => !["Completed", "Cancelled", "Expired"].includes(r.status)).length, queueWaiting: queues.filter((q) => q.status === "Waiting").length, sales: transactions.reduce((sum, item) => sum + item.totalAmount, 0) }; }
  async getSalesTrend() { return (await this.repo.getTransactions()).map((t) => ({ date: t.createdAt.slice(0, 10), amount: t.totalAmount })); }
  async getReservationTrend() { return (await this.repo.getReservations()).map((r) => ({ date: r.createdAt.slice(0, 10), count: 1 })); }
  async getProductDemand() { return (await this.repo.getReservationItems()).map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity })); }
  async getInventoryHealth() { return (await this.repo.getInventory()).map((i) => ({ ...i, availableQuantity: i.physicalQuantity - i.reservedQuantity, lowStock: i.physicalQuantity - i.reservedQuantity <= i.reorderLevel })); }
  getQueuePerformance() { return this.getSummary(); }
}
