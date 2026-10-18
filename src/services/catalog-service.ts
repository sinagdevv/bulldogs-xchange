import { AppError } from "../lib/errors.js";
import type { Product } from "../domain/models.js";
import type { SharePointRepository } from "../repositories/repository.js";

export interface CatalogQuery { search?: string; category?: string; featured?: boolean; active?: boolean; sort?: "title" | "price" | "-price" }

const isTestRecord=(product:Product)=>/^test[-_]|^demo[-_]/i.test(product.sku)||/^(test|synthetic demo)\b/i.test(product.title);
const sourceSkus=new Set(["SHS-POLO-M","SHS-PANTS-M","SHS-BLSE-F","SHS-PANTS-F","COL-POLO-M","COL-PANTS-M","COL-BLSE-F","COL-PANTS-F","COL-PANTS-W","PE-SHIRT","PE-JOG","NSTP-SHIRT","MRC-SHIRT","MRC-TOTE","MRC-CAP","MRC-SWEAT","MRC-VARSITY","MRC-LFAN","MRC-HFAN"]);
const isOfficialCatalogProduct=(product:Product)=>!isTestRecord(product)&&sourceSkus.has(product.sku);

export class CatalogService {
  constructor(private repo: SharePointRepository) {}
  async getCategories() { const products=(await this.repo.getProducts()).filter(isOfficialCatalogProduct);const used=new Set(products.map(product=>product.categoryId));return (await this.repo.getCategories()).filter(category=>used.has(category.id)); }
  async getProducts(query: CatalogQuery = {}) {
    const search = query.search?.trim().toLowerCase();
    const products = (await this.repo.getProducts()).filter(isOfficialCatalogProduct).filter((p) =>
      (!search || p.title.toLowerCase().includes(search) || p.description.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)) &&
      (!query.category || p.categoryId === query.category) &&
      (query.featured === undefined || p.isFeatured === query.featured) &&
      (query.active === undefined || p.isActive === query.active));
    return products.sort(query.sort === "price" ? (a, b) => a.price - b.price : query.sort === "-price" ? (a, b) => b.price - a.price : (a, b) => a.title.localeCompare(b.title));
  }
  async getProduct(id: string) { const product = await this.repo.getProductById(id); if (!product||!isOfficialCatalogProduct(product)) throw new AppError("NOT_FOUND", "Product not found."); return product; }
  async getVariants(productId: string) { await this.getProduct(productId); return this.repo.getVariantsByProductId(productId); }
  async getAvailability(productId: string) { await this.getProduct(productId); return (await this.repo.getInventoryByProductId(productId)).map((item) => { const availableQuantity = item.physicalQuantity - item.reservedQuantity; return { ...item, availableQuantity, status: availableQuantity <= 0 ? "Out of Stock" as const : availableQuantity <= item.reorderLevel ? "Low Stock" as const : "Healthy" as const }; }); }
  async available(variantId: string) { const item = await this.repo.getInventoryByVariantId(variantId); return item ? item.physicalQuantity - item.reservedQuantity : 0; }
}
