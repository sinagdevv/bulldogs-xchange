import { AppError } from "../lib/errors.js";
import type { Product } from "../domain/models.js";
import type { SharePointRepository } from "../repositories/repository.js";

export interface CatalogQuery { search?: string; category?: string; featured?: boolean; active?: boolean; sort?: "title" | "price" | "-price" }

const publicCatalog:Record<string,{title:string;description:string}>={
  "BX-SHIRT":{title:"Bulldogs Shirt",description:"A Bulldogs shirt available for campus reservation and pickup."},
  "BX-CAP":{title:"Bulldogs Cap",description:"A Bulldogs cap available for campus reservation and pickup."},
  "BX-TOTE":{title:"Bulldogs Tote Bag",description:"A Bulldogs tote bag available for campus reservation and pickup."},
};
const present=(product:Product):Product=>({...product,...publicCatalog[product.sku]});

export class CatalogService {
  constructor(private repo: SharePointRepository) {}
  async getCategories() { const products=(await this.repo.getProducts()).filter(product=>publicCatalog[product.sku]);const used=new Set(products.map(product=>product.categoryId));return (await this.repo.getCategories()).filter(category=>used.has(category.id)).map(category=>({...category,title:category.title.replace(/^Synthetic Demo Merchandise$/i,"Campus merchandise").replace(/^Demo Apparel$/i,"Apparel")})); }
  async getProducts(query: CatalogQuery = {}) {
    const search = query.search?.trim().toLowerCase();
    const products = (await this.repo.getProducts()).filter((p) => publicCatalog[p.sku]).map(present).filter((p) =>
      (!search || p.title.toLowerCase().includes(search) || p.description.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)) &&
      (!query.category || p.categoryId === query.category) &&
      (query.featured === undefined || p.isFeatured === query.featured) &&
      (query.active === undefined || p.isActive === query.active));
    return products.sort(query.sort === "price" ? (a, b) => a.price - b.price : query.sort === "-price" ? (a, b) => b.price - a.price : (a, b) => a.title.localeCompare(b.title));
  }
  async getProduct(id: string) { const product = await this.repo.getProductById(id); if (!product||!publicCatalog[product.sku]) throw new AppError("NOT_FOUND", "Product not found."); return present(product); }
  async getVariants(productId: string) { await this.getProduct(productId); return this.repo.getVariantsByProductId(productId); }
  async getAvailability(productId: string) { await this.getProduct(productId); return (await this.repo.getInventoryByProductId(productId)).map((item) => { const availableQuantity = item.physicalQuantity - item.reservedQuantity; return { ...item, availableQuantity, status: availableQuantity <= 0 ? "Out of Stock" as const : availableQuantity <= item.reorderLevel ? "Low Stock" as const : "Healthy" as const }; }); }
  async available(variantId: string) { const item = await this.repo.getInventoryByVariantId(variantId); return item ? item.physicalQuantity - item.reservedQuantity : 0; }
}
