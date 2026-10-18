/**
 * Supplemental catalog — program uniforms not yet in the Supabase database.
 *
 * These are displayed as browsable, non-reservable items.
 * Price is "upon inquiry" (price field is -1; UI detects this).
 * Images are sourced from the verified /images/products/showcase/ directory.
 *
 * Records are identified via  "supp-<SKU>" IDs so they never collide with DB IDs.
 * Do NOT remove or modify existing SharePoint records (19 products) — this file
 * is additive only.
 */

import type {Category,Product} from "./types";

/** Sentinel price value meaning "Price upon inquiry — contact the Xchange counter." */
export const PRICE_ON_INQUIRY = -1;

export const supplementalCategories: Category[] = [
  {id: "supp-tm",   title: "Tourism Management",     isActive: true},
  {id: "supp-psy",  title: "Psychology",              isActive: true},
  {id: "supp-hm",   title: "Hospitality Management",  isActive: true},
  {id: "supp-trad", title: "Traditional (College/SHS)", isActive: true},
];

const showcase = (file: string) => `/images/products/showcase/${file}`;

export const supplementalProducts: Product[] = [
  // ── TOURISM MANAGEMENT (TM) ──────────────────────────────────────────────
  {
    id: "supp-TM-BLAZ-001", sku: "TM-BLAZ-001",
    title: "TM Blazer", categoryId: "supp-tm",
    description: "Tourism Management uniform blazer.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-BLAZ-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-COAT-001", sku: "TM-COAT-001",
    title: "TM Coat", categoryId: "supp-tm",
    description: "Tourism Management uniform coat.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-COAT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-PANT-001", sku: "TM-PANT-001",
    title: "TM Trousers", categoryId: "supp-tm",
    description: "Tourism Management uniform trousers.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-PANT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-SCRF-001", sku: "TM-SCRF-001",
    title: "TM Scarf / Necktie", categoryId: "supp-tm",
    description: "Tourism Management uniform scarf or necktie accessory.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-SCRF-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-SKRT-001", sku: "TM-SKRT-001",
    title: "TM Skirt", categoryId: "supp-tm",
    description: "Tourism Management uniform skirt (female).",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-SKRT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-VEST-001-F", sku: "TM-VEST-001-F",
    title: "TM Vest (Female)", categoryId: "supp-tm",
    description: "Tourism Management uniform vest — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-VEST-001-F-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TM-VEST-001-M", sku: "TM-VEST-001-M",
    title: "TM Vest (Male)", categoryId: "supp-tm",
    description: "Tourism Management uniform vest — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TM-VEST-001-M-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── PSYCHOLOGY (PSY) ─────────────────────────────────────────────────────
  {
    id: "supp-PSY-PANT-001-F", sku: "PSY-PANT-001-F",
    title: "PSY Trousers (Female)", categoryId: "supp-psy",
    description: "Psychology uniform trousers — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("PSY-PANT-001-F-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-PANT-001-M", sku: "PSY-PANT-001-M",
    title: "PSY Trousers (Male)", categoryId: "supp-psy",
    description: "Psychology uniform trousers — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("PSY-PANT-001-M-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-SKRT-001", sku: "PSY-SKRT-001",
    title: "PSY Skirt", categoryId: "supp-psy",
    description: "Psychology uniform skirt.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("PSY-SKRT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-TOP-001", sku: "PSY-TOP-001",
    title: "PSY Top", categoryId: "supp-psy",
    description: "Psychology uniform top.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("PSY-TOP-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-PSY-TOP-002", sku: "PSY-TOP-002",
    title: "PSY Top (variant)", categoryId: "supp-psy",
    description: "Psychology uniform top — alternate style.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("PSY-TOP-002-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── HOSPITALITY MANAGEMENT (HM) ──────────────────────────────────────────
  {
    id: "supp-HM-BLAZ-001-F", sku: "HM-BLAZ-001-F",
    title: "HM Blazer (Female)", categoryId: "supp-hm",
    description: "Hospitality Management uniform blazer — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-BLAZ-001-F-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-BLAZ-001-M", sku: "HM-BLAZ-001-M",
    title: "HM Blazer (Male)", categoryId: "supp-hm",
    description: "Hospitality Management uniform blazer — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-BLAZ-001-M-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-PANT-001", sku: "HM-PANT-001",
    title: "HM Trousers", categoryId: "supp-hm",
    description: "Hospitality Management uniform trousers.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-PANT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-SKRT-001", sku: "HM-SKRT-001",
    title: "HM Skirt", categoryId: "supp-hm",
    description: "Hospitality Management uniform skirt.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-SKRT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-TOP-001", sku: "HM-TOP-001",
    title: "HM Top", categoryId: "supp-hm",
    description: "Hospitality Management uniform top.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-TOP-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-TOP-002", sku: "HM-TOP-002",
    title: "HM Top (variant)", categoryId: "supp-hm",
    description: "Hospitality Management uniform top — alternate style.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-TOP-002-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-VEST-001-F", sku: "HM-VEST-001-F",
    title: "HM Vest (Female)", categoryId: "supp-hm",
    description: "Hospitality Management uniform vest — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-VEST-001-F-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-HM-VEST-001-M", sku: "HM-VEST-001-M",
    title: "HM Vest (Male)", categoryId: "supp-hm",
    description: "Hospitality Management uniform vest — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("HM-VEST-001-M-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },

  // ── TRADITIONAL UNIFORM (TRAD) ───────────────────────────────────────────
  {
    id: "supp-TRAD-PANT-001-F-COL", sku: "TRAD-PANT-001-F-COL",
    title: "Traditional Trousers – College (Female)", categoryId: "supp-trad",
    description: "Traditional College uniform trousers — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-PANT-001-F-COL-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-PANT-001-M-COL", sku: "TRAD-PANT-001-M-COL",
    title: "Traditional Trousers – College (Male)", categoryId: "supp-trad",
    description: "Traditional College uniform trousers — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-PANT-001-M-COL-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-PANT-001-F-SHS", sku: "TRAD-PANT-001-F-SHS",
    title: "Traditional Trousers – SHS (Female)", categoryId: "supp-trad",
    description: "Traditional SHS uniform trousers — female cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-PANT-001-F-SHS-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-PANT-001-M-SHS", sku: "TRAD-PANT-001-M-SHS",
    title: "Traditional Trousers – SHS (Male)", categoryId: "supp-trad",
    description: "Traditional SHS uniform trousers — male cut.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-PANT-001-M-SHS-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-SKRT-001", sku: "TRAD-SKRT-001",
    title: "Traditional Skirt", categoryId: "supp-trad",
    description: "Traditional uniform skirt (College/SHS).",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-SKRT-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-TOP-001", sku: "TRAD-TOP-001",
    title: "Traditional Top", categoryId: "supp-trad",
    description: "Traditional uniform top.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-TOP-001-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
  {
    id: "supp-TRAD-TOP-002", sku: "TRAD-TOP-002",
    title: "Traditional Top (variant)", categoryId: "supp-trad",
    description: "Traditional uniform top — alternate style.",
    price: PRICE_ON_INQUIRY, imageUrl: showcase("TRAD-TOP-002-FRONT.webp"),
    isFeatured: false, isActive: true, supplemental: true,
  },
];

/** Returns true when id belongs to a supplemental (non-DB) product. */
export const isSupplementalId = (id: string) => id.startsWith("supp-");

/** Filter supplemental products by category and search term (mirrors the API's behavior). */
export function filterSupplemental(categoryId?: string, search?: string): Product[] {
  const term = search?.trim().toLowerCase() ?? "";
  return supplementalProducts.filter(p =>
    (!categoryId || p.categoryId === categoryId) &&
    (!term || `${p.title} ${p.description} ${p.sku}`.toLowerCase().includes(term))
  );
}
