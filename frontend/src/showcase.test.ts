import {describe,expect,it} from "vitest";
import {SHOWCASE_CATEGORIES,SHOWCASE_TYPES,showcaseItems} from "./showcase";

describe("merchandise showcase manifest",()=>{
  it("covers all optimized photos without duplicate paths and keeps only reviewed mappings approved",()=>{
    expect(showcaseItems).toHaveLength(51);
    expect(new Set(showcaseItems.map(x=>x.src)).size).toBe(51);
    expect(showcaseItems.filter(x=>x.approved)).toHaveLength(3);
    expect(new Set(showcaseItems.map(x=>x.category))).toEqual(new Set(SHOWCASE_CATEGORIES));
    expect(new Set(showcaseItems.map(x=>x.type))).toEqual(new Set(SHOWCASE_TYPES));
  });
});
