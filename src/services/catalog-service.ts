import { AppError } from "../lib/errors.js";
import type { SharePointRepository } from "../repositories/repository.js";

export interface CatalogQuery { search?: string; category?: string; featured?: boolean; active?: boolean; sort?: "title" | "price" | "-price" }

export class CatalogService {
  constructor(private repo: SharePointRepository) {}
  getCategories() { return this.repo.categories; }
  getProducts(query: CatalogQuery = {}) {
    const search = query.search?.trim().toLowerCase();
    const products = this.repo.products.filter((p) =>
      (!search || p.title.toLowerCase().includes(search) || p.description.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)) &&
      (!query.category || p.categoryId === query.category) &&
      (query.featured === undefined || p.isFeatured === query.featured) &&
      (query.active === undefined || p.isActive === query.active));
    return products.sort(query.sort === "price" ? (a, b) => a.price - b.price : query.sort === "-price" ? (a, b) => b.price - a.price : (a, b) => a.title.localeCompare(b.title));
  }
  getProduct(id: string) { const product = this.repo.products.find((p) => p.id === id); if (!product) throw new AppError("NOT_FOUND", "Product not found."); return product; }
  getVariants(productId: string) { this.getProduct(productId); return this.repo.variants.filter((v) => v.productId === productId); }
  getAvailability(productId: string) { return this.getVariants(productId).map((variant) => ({ productVariantId: variant.id, availableQuantity: this.available(variant.id) })); }
  available(variantId: string) { const item = this.repo.inventory.find((i) => i.productVariantId === variantId); return item ? item.physicalQuantity - item.reservedQuantity : 0; }
}

