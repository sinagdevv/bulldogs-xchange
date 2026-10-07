import { z } from "zod";
import type { User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";
import { CatalogService } from "./catalog-service.js";

export const reservationInput = z.object({ items: z.array(z.object({ productVariantId: z.string().min(1), quantity: z.number().int().positive() })).min(1) });
export class ReservationService {
  constructor(private repo: SharePointRepository, private catalog: CatalogService) {}
  list(user: User) { return user.role === "Customer" ? this.repo.reservations.filter((r) => r.customerEmail === user.email) : this.repo.reservations; }
  get(id: string, user: User) { const item = this.repo.reservations.find((r) => r.id === id); if (!item || (user.role === "Customer" && item.customerEmail !== user.email)) throw new AppError("NOT_FOUND", "Reservation not found."); return item; }
  create(input: unknown, user: User) {
    const parsed = reservationInput.safeParse(input); if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid reservation.");
    for (const requested of parsed.data.items) {
      const variant = this.repo.variants.find((v) => v.id === requested.productVariantId); if (!variant) throw new AppError("NOT_FOUND", "Variant not found.");
      if (!variant.isActive) throw new AppError("VARIANT_INACTIVE", "Variant is inactive.");
      if (!this.catalog.getProduct(variant.productId).isActive) throw new AppError("PRODUCT_INACTIVE", "Product is inactive.");
      if (this.catalog.available(variant.id) < requested.quantity) throw new AppError("INSUFFICIENT_STOCK", "Insufficient stock.");
    }
    const id = `res-${this.repo.reservations.length + 1}`; const reference = `BX-${new Date().getUTCFullYear()}-${String(this.repo.reservations.length + 1).padStart(4, "0")}`; const timestamp = new Date().toISOString();
    const reservation = { id, reference, customerEmail: user.email, status: "Pending" as const, expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), createdAt: timestamp, updatedAt: timestamp };
    this.repo.reservations.push(reservation);
    for (const item of parsed.data.items) { const variant = this.repo.variants.find((v) => v.id === item.productVariantId)!; const product = this.catalog.getProduct(variant.productId); this.repo.reservationItems.push({ id: `ri-${this.repo.reservationItems.length + 1}`, reservationId: id, productVariantId: item.productVariantId, quantity: item.quantity, unitPrice: product.price }); const inventory = this.repo.inventory.find((i) => i.productVariantId === item.productVariantId)!; inventory.reservedQuantity += item.quantity; }
    return reservation;
  }
  cancel(id: string, user: User) { const item = this.get(id, user); if (!["Pending", "Confirmed"].includes(item.status)) throw new AppError("INVALID_RESERVATION_STATUS", "Reservation cannot be cancelled."); item.status = "Cancelled"; item.updatedAt = new Date().toISOString(); for (const line of this.repo.reservationItems.filter((i) => i.reservationId === id)) { const stock = this.repo.inventory.find((i) => i.productVariantId === line.productVariantId); if (stock) stock.reservedQuantity -= line.quantity; } return item; }
}

