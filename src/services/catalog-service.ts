import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";

export interface CatalogQuery { search?: string; category?: string; featured?: boolean; active?: boolean; sort?: "title" | "price" | "-price" }

export class CatalogService {
  constructor(private repo: SharePointRepository) {}
  getCategories() { return this.repo.getCategories(); }
  async getProducts(query: CatalogQuery = {}) {
    const search = query.search?.trim().toLowerCase();
    const products = (await this.repo.getProducts()).filter((p) =>
      (!search || p.title.toLowerCase().includes(search) || p.description.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)) &&
      (!query.category || p.categoryId === query.category) &&
      (query.featured === undefined || p.isFeatured === query.featured) &&
      (query.active === undefined || p.isActive === query.active));
    return products.sort(query.sort === "price" ? (a, b) => a.price - b.price : query.sort === "-price" ? (a, b) => b.price - a.price : (a, b) => a.title.localeCompare(b.title));
  }
  async getProduct(id: string) { const product = await this.repo.getProductById(id); if (!product) throw new AppError("NOT_FOUND", "Product not found."); return product; }
  async getVariants(productId: string) { await this.getProduct(productId); return this.repo.getVariantsByProductId(productId); }
  async getAvailability(productId: string) { await this.getProduct(productId); return (await this.repo.getInventoryByProductId(productId)).map((item) => { const availableQuantity = item.physicalQuantity - item.reservedQuantity; return { ...item, availableQuantity, status: availableQuantity <= 0 ? "Out of Stock" as const : availableQuantity <= item.reorderLevel ? "Low Stock" as const : "Healthy" as const }; }); }
  async available(variantId: string) { const item = await this.repo.getInventoryByVariantId(variantId); return item ? item.physicalQuantity - item.reservedQuantity : 0; }
}
