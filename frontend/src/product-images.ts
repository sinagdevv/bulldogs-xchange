import type {Product} from "./types";

const catalogImages:Record<string,string>={
  "BX-CAP":"/images/products/approved/MER-CAP-001-FRONT.webp",
  "BX-SHIRT":"/images/products/approved/MER-TSH-001-FRONT.webp",
  "BX-TOTE":"/images/products/approved/MER-TOTE-001-FRONT.webp",
};

const catalogCopy:Record<string,{title:string;description:string}>={
  "BX-SHIRT":{title:"Bulldogs Shirt",description:"A Bulldogs shirt available for campus reservation and pickup."},
  "BX-CAP":{title:"Bulldogs Cap",description:"A Bulldogs cap available for campus reservation and pickup."},
  "BX-TOTE":{title:"Bulldogs Tote Bag",description:"A Bulldogs tote bag available for campus reservation and pickup."},
};

export const catalogImageForSku=(sku:string)=>catalogImages[sku];
export const isApprovedCatalogProduct=(product:Product)=>Boolean(catalogImages[product.sku]);
export const presentCatalogProduct=(product:Product):Product=>({...product,...catalogCopy[product.sku]});
export const productImage=(product:Product)=>catalogImages[product.sku];

