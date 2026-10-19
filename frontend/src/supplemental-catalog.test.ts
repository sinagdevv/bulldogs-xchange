import {describe,expect,it} from "vitest";
import {isCrossListedInCategory,supplementalDemoPrices,supplementalProducts} from "./supplemental-catalog";
import type {Product} from "./types";

const official=(sku:string,categoryId:string):Product=>({id:sku,title:sku,categoryId,sku,description:"",price:1,isFeatured:false,isActive:true});

describe("supplemental category visibility",()=>{
  it("uses disclosed demo prices without changing official catalog prices",()=>{
    expect(supplementalDemoPrices).toMatchObject({
      "TM-BLAZ-001":600,"TM-COAT-001":600,"TM-PANT-001":550,"TM-SCRF-001":400,
      "TM-SKRT-001":500,"TM-VEST-001-F":450,"TM-VEST-001-M":450,
    });
    expect(supplementalProducts.every(product=>product.price>=400&&product.price<=600)).toBe(true);
  });
  it("cross-lists the canonical skirt only into official SHS and College categories",()=>{
    const skirt=supplementalProducts.find(product=>product.sku==="TRAD-SKRT-001")!;
    const products=[official("SHS-POLO-M","shs"),official("COL-POLO-M","college"),official("PE-JOG","pe"),skirt];
    expect(isCrossListedInCategory(skirt,"shs",products)).toBe(true);
    expect(isCrossListedInCategory(skirt,"college",products)).toBe(true);
    expect(isCrossListedInCategory(skirt,"pe",products)).toBe(false);
  });
});
