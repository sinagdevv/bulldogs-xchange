import type {Product} from "./types";
import {catalogImageManifest} from "./catalog-image-manifest";

export const catalogImageForSku=(sku:string)=>catalogImageManifest[sku]?.asset;
export const presentCatalogProduct=(product:Product):Product=>product;
export const productImage=(product:Product)=>product.imageUrl||catalogImageForSku(product.sku);

