/**
 * Supplemental catalog — program uniforms not yet in the Supabase database.
 *
 * These are displayed as browsable, non-reservable items.
 * Prices are clearly labelled as demo prices and do not alter official records.
 * Images are sourced from the verified /images/products/showcase/ directory.
 *
 * Records are identified via  "supp-<SKU>" IDs so they never collide with DB IDs.
 * Do NOT remove or modify existing SharePoint records (19 products) — this file
 * is additive only.
 */

import type {Category,Product} from "./types";

/** Proposed, non-authoritative prices for supplemental catalog-only apparel. */
export const supplementalDemoPrices={
  "TM-BLAZ-001":600,"TM-COAT-001":600,"TM-PANT-001":550,"TM-SCRF-001":400,"TM-SKRT-001":500,"TM-VEST-001-F":450,"TM-VEST-001-M":450,
  "PSY-PANT-001-F":550,"PSY-PANT-001-M":550,"PSY-SKRT-001":500,"PSY-TOP-001":500,"PSY-TOP-002":500,
  "HM-BLAZ-001-F":600,"HM-BLAZ-001-M":600,"HM-PANT-001":550,"HM-SKRT-001":500,"HM-TOP-001":500,"HM-TOP-002":500,"HM-VEST-001-F":450,"HM-VEST-001-M":450,
  "TRAD-SKRT-001":500,
} as const satisfies Record<string,number>;
const demoPrice=(sku:keyof typeof supplementalDemoPrices)=>supplementalDemoPrices[sku];

export const supplementalCategories: Category[] = [
  {id: "supp-tm",   title: "Tourism Management",     isActive: true},
  {id: "supp-psy",  title: "Psychology",              isActive: true},
  {id: "supp-hm",   title: "Hospitality Management",  isActive: true},
];

const showcase = (file: string) => `/images/products/showcase/${file}`;

export const supplementalProducts: Product[] = [
  // ── TOURISM MANAGEMENT (TM) ──────────────────────────────────────────────
  {
    id: "supp-TM-BLAZ-001", sku: "TM-BLAZ-001",
    title: "TM Blazer", categoryId: "supp-tm",
    description: "Tourism Management uniform blazer.",
    price: demoPrice("TM-BLAZ-001"), imageUrl: showcase("TM-BLAZ-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-COAT-001", sku: "TM-COAT-001",
    title: "TM Coat", categoryId: "supp-tm",
    description: "Tourism Management uniform coat.",
    price: demoPrice("TM-COAT-001"), imageUrl: showcase("TM-COAT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-PANT-001", sku: "TM-PANT-001",
    title: "TM Trousers", categoryId: "supp-tm",
    description: "Tourism Management uniform trousers.",
    price: demoPrice("TM-PANT-001"), imageUrl: showcase("TM-PANT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-SCRF-001", sku: "TM-SCRF-001",
    title: "TM Scarf / Necktie", categoryId: "supp-tm",
    description: "Tourism Management uniform scarf or necktie accessory.",
    price: demoPrice("TM-SCRF-001"), imageUrl: showcase("TM-SCRF-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-SKRT-001", sku: "TM-SKRT-001",
    title: "TM Skirt", categoryId: "supp-tm",
    description: "Tourism Management uniform skirt (female).",
    price: demoPrice("TM-SKRT-001"), imageUrl: showcase("TM-SKRT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-VEST-001-F", sku: "TM-VEST-001-F",
    title: "TM Vest (Female)", categoryId: "supp-tm",
    description: "Tourism Management uniform vest — female cut.",
    price: demoPrice("TM-VEST-001-F"), imageUrl: showcase("TM-VEST-001-F-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-VEST-001-M", sku: "TM-VEST-001-M",
    title: "TM Vest (Male)", categoryId: "supp-tm",
    description: "Tourism Management uniform vest — male cut.",
    price: demoPrice("TM-VEST-001-M"), imageUrl: showcase("TM-VEST-001-M-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── PSYCHOLOGY (PSY) ─────────────────────────────────────────────────────
  {
    id: "supp-PSY-PANT-001-F", sku: "PSY-PANT-001-F",
    title: "PSY Trousers (Female)", categoryId: "supp-psy",
    description: "Psychology uniform trousers — female cut.",
    price: demoPrice("PSY-PANT-001-F"), imageUrl: showcase("PSY-PANT-001-F-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-PANT-001-M", sku: "PSY-PANT-001-M",
    title: "PSY Trousers (Male)", categoryId: "supp-psy",
    description: "Psychology uniform trousers — male cut.",
    price: demoPrice("PSY-PANT-001-M"), imageUrl: showcase("PSY-PANT-001-M-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-SKRT-001", sku: "PSY-SKRT-001",
    title: "PSY Skirt", categoryId: "supp-psy",
    description: "Psychology uniform skirt.",
    price: demoPrice("PSY-SKRT-001"), imageUrl: showcase("PSY-SKRT-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-TOP-001", sku: "PSY-TOP-001",
    title: "PSY Top", categoryId: "supp-psy",
    description: "Psychology uniform top.",
    price: demoPrice("PSY-TOP-001"), imageUrl: showcase("PSY-TOP-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-TOP-002", sku: "PSY-TOP-002",
    title: "PSY Top (variant)", categoryId: "supp-psy",
    description: "Psychology uniform top — alternate style.",
    price: demoPrice("PSY-TOP-002"), imageUrl: showcase("PSY-TOP-002-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── HOSPITALITY MANAGEMENT (HM) ──────────────────────────────────────────
  {
    id: "supp-HM-BLAZ-001-F", sku: "HM-BLAZ-001-F",
    title: "HM Blazer (Female)", categoryId: "supp-hm",
    description: "Hospitality Management uniform blazer — female cut.",
    price: demoPrice("HM-BLAZ-001-F"), imageUrl: showcase("HM-BLAZ-001-F-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-BLAZ-001-M", sku: "HM-BLAZ-001-M",
    title: "HM Blazer (Male)", categoryId: "supp-hm",
    description: "Hospitality Management uniform blazer — male cut.",
    price: demoPrice("HM-BLAZ-001-M"), imageUrl: showcase("HM-BLAZ-001-M-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-PANT-001", sku: "HM-PANT-001",
    title: "HM Trousers", categoryId: "supp-hm",
    description: "Hospitality Management uniform trousers.",
    price: demoPrice("HM-PANT-001"), imageUrl: showcase("HM-PANT-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-SKRT-001", sku: "HM-SKRT-001",
    title: "HM Skirt", categoryId: "supp-hm",
    description: "Hospitality Management uniform skirt.",
    price: demoPrice("HM-SKRT-001"), imageUrl: showcase("HM-SKRT-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-TOP-001", sku: "HM-TOP-001",
    title: "HM Top", categoryId: "supp-hm",
    description: "Hospitality Management uniform top.",
    price: demoPrice("HM-TOP-001"), imageUrl: showcase("HM-TOP-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-TOP-002", sku: "HM-TOP-002",
    title: "HM Top (variant)", categoryId: "supp-hm",
    description: "Hospitality Management uniform top — alternate style.",
    price: demoPrice("HM-TOP-002"), imageUrl: showcase("HM-TOP-002-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-VEST-001-F", sku: "HM-VEST-001-F",
    title: "HM Vest (Female)", categoryId: "supp-hm",
    description: "Hospitality Management uniform vest — female cut.",
    price: demoPrice("HM-VEST-001-F"), imageUrl: showcase("HM-VEST-001-F-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-VEST-001-M", sku: "HM-VEST-001-M",
    title: "HM Vest (Male)", categoryId: "supp-hm",
    description: "Hospitality Management uniform vest — male cut.",
    price: demoPrice("HM-VEST-001-M"), imageUrl: showcase("HM-VEST-001-M-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── TRADITIONAL UNIFORM (TRAD) ───────────────────────────────────────────
  // 2026-10 correction: TRAD-SKRT-001 was removed in error and is restored
  // here as a single canonical listing. It is shown under BOTH the official
  // SHS and College category filters (see CROSS_LISTED_SKUS below) without
  // being duplicated into two product cards -- the real SHS/College category
  // ids live only in the production database, so the frontend resolves them
  // at request time (frontend/src/api.ts) and passes them in. No standalone
  // "Traditional (College/SHS)" filter chip is reintroduced.
  // TRAD-TOP-001/002 remain removed: they were visually compared against the
  // official product photos and are the same garments as COL-BLSE-F (female
  // blouse, identical NJ-1900 shield, piping and cut) and COL-POLO-M (male
  // polo, identical shield and collar) -- genuine duplicates, official DB
  // entries take precedence.
  {
    id: "supp-TRAD-SKRT-001", sku: "TRAD-SKRT-001",
    title: "Traditional Skirt", categoryId: "supp-trad",
    description: "Traditional uniform skirt, shared by the SHS and College traditional sets.",
    price: demoPrice("TRAD-SKRT-001"), imageUrl: showcase("TRAD-SKRT-001-FRONT-CUTOUT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
];

/**
 * SKUs that must also appear when the official SHS or College category
 * filter is selected, in addition to (not instead of) their own listing.
 * Resolved real category ids are supplied by the caller at request time --
 * this file never hardcodes production database ids. Listing a SKU here
 * does not duplicate its card: a product is rendered once per filter view,
 * and a single view only ever shows one category at a time.
 */
export const CROSS_LISTED_SKUS = new Set<string>(["TRAD-SKRT-001"]);

/** True when a cross-listed supplemental product belongs in an official SHS/College view. */
export const isCrossListedInCategory=(product:Product,categoryId:string,products:readonly Product[])=>
  CROSS_LISTED_SKUS.has(product.sku)&&products.some(item=>item.categoryId===categoryId&&/^(SHS|COL)-/.test(item.sku));

/** Returns true when id belongs to a supplemental (non-DB) product. */
export const isSupplementalId = (id: string) => id.startsWith("supp-");

/** Filter supplemental products by category and search term (mirrors the API's behavior). */
export function filterSupplemental(categoryId?: string, search?: string, crossListCategoryIds: readonly string[] = []): Product[] {
  const term = search?.trim().toLowerCase() ?? "";
  return supplementalProducts.filter(p =>
    (!categoryId || p.categoryId === categoryId || (CROSS_LISTED_SKUS.has(p.sku) && crossListCategoryIds.includes(categoryId))) &&
    (!term || `${p.title} ${p.description} ${p.sku}`.toLowerCase().includes(term))
  );
}
