import {describe,expect,it} from "vitest";
import {isCrossListedInCategory,supplementalProducts} from "./supplemental-catalog";
import type {Product} from "./types";

const official=(sku:string,categoryId:string):Product=>({id:sku,title:sku,categoryId,sku,description:"",price:1,isFeatured:false,isActive:true});

describe("supplemental category visibility",()=>{
  it("cross-lists the canonical skirt only into official SHS and College categories",()=>{
    const skirt=supplementalProducts.find(product=>product.sku==="TRAD-SKRT-001")!;
    const products=[official("SHS-POLO-M","shs"),official("COL-POLO-M","college"),official("PE-JOG","pe"),skirt];
    expect(isCrossListedInCategory(skirt,"shs",products)).toBe(true);
    expect(isCrossListedInCategory(skirt,"college",products)).toBe(true);
    expect(isCrossListedInCategory(skirt,"pe",products)).toBe(false);
  });
});
