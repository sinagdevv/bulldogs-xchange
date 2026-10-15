import { z } from "zod";
import type { User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";
import { isMockRepository } from "../repositories/provider.js";
import { CatalogService } from "./catalog-service.js";

export const reservationInput = z.object({ items: z.array(z.object({ productVariantId: z.string().min(1), quantity: z.number().int().positive() })).min(1) });
export class ReservationService {
  constructor(private repo: SharePointRepository, private catalog: CatalogService) {}
  list(user: User) { return user.role === "Customer" ? this.repo.getReservationsByCustomerEmail(user.email) : this.repo.getReservations(); }
  async get(id: string, user: User) { const item = await this.repo.getReservationById(id); if (!item || (user.role === "Customer" && item.customerEmail !== user.email)) throw new AppError("NOT_FOUND", "Reservation not found."); const [lines,variants,products,queues]=await Promise.all([this.repo.getReservationItemsByReservationId(id),this.repo.getVariants(),this.repo.getProducts(),this.repo.getQueues()]);const details=lines.map(line=>{const variant=variants.find(value=>value.id===line.productVariantId),product=products.find(value=>value.id===variant?.productId);return{...line,productId:product?.id,productName:product?.title??"Unavailable product",productSku:product?.sku,variantName:variant?.name??"Unavailable variant",variantSku:variant?.variantSku,subtotal:Math.round(line.quantity*line.unitPrice*100)/100};}),queue=queues.find(value=>value.reservationId===id);return{...item,items:details,totalAmount:Math.round(details.reduce((sum,line)=>sum+line.subtotal,0)*100)/100,...(queue?{queue:{queueNumber:queue.queueNumber,status:queue.status,queueType:queue.queueType}}:{})}; }
  async create(input: unknown, user: User) {
    if (!isMockRepository(this.repo)) throw new AppError("CONFIGURATION_ERROR", "Reservation writes are not implemented for the selected data provider.");
    const parsed = reservationInput.safeParse(input); if (!parsed.success) throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid reservation.");
    for (const requested of parsed.data.items) {
      const variant = (await this.repo.getVariants()).find((v) => v.id === requested.productVariantId); if (!variant) throw new AppError("NOT_FOUND", "Variant not found.");
      if (!variant.isActive) throw new AppError("VARIANT_INACTIVE", "Variant is inactive.");
      if (!(await this.catalog.getProduct(variant.productId)).isActive) throw new AppError("PRODUCT_INACTIVE", "Product is inactive.");
      if (await this.catalog.available(variant.id) < requested.quantity) throw new AppError("INSUFFICIENT_STOCK", "Insufficient stock.");
    }
    const id = `res-${this.repo.reservations.length + 1}`; const reference = `BX-${new Date().getUTCFullYear()}-${String(this.repo.reservations.length + 1).padStart(4, "0")}`; const timestamp = new Date().toISOString();
    const reservation = { id, reference, customerEmail: user.email, status: "Pending" as const, expiresAt: new Date(Date.now() + 3 * 86400000).toISOString(), createdAt: timestamp, updatedAt: timestamp };
    this.repo.reservations.push(reservation);
    for (const item of parsed.data.items) { const variant = this.repo.variants.find((v) => v.id === item.productVariantId)!; const product = await this.catalog.getProduct(variant.productId); this.repo.reservationItems.push({ id: `ri-${this.repo.reservationItems.length + 1}`, reservationId: id, productVariantId: item.productVariantId, quantity: item.quantity, unitPrice: product.price }); const inventory = this.repo.inventory.find((i) => i.productVariantId === item.productVariantId)!; inventory.reservedQuantity += item.quantity; }
    return reservation;
  }
  async cancel(id: string, user: User) { if (!isMockRepository(this.repo)) throw new AppError("CONFIGURATION_ERROR", "Reservation writes are not implemented for the selected data provider."); const item = await this.get(id, user); if (!["Pending", "Confirmed"].includes(item.status)) throw new AppError("INVALID_RESERVATION_STATUS", "Reservation cannot be cancelled."); item.status = "Cancelled"; item.updatedAt = new Date().toISOString(); for (const line of this.repo.reservationItems.filter((i) => i.reservationId === id)) { const stock = this.repo.inventory.find((i) => i.productVariantId === line.productVariantId); if (stock) stock.reservedQuantity -= line.quantity; } return item; }
}
