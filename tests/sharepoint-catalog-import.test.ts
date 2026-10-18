import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
import type {SqlExecutor} from "../src/integrations/sql-server.js";
import {planSharePointCatalogImport,readSharePointCatalog} from "../src/services/sharepoint-catalog-import-service.js";

const dir=resolve("data/sharepoint-import");
describe("SharePoint catalog import",()=>{
  it("accepts only the reviewed source rows and leaves inventory as a later operation",async()=>{const catalog=await readSharePointCatalog(dir);expect(catalog).toMatchObject({categories:{length:5},products:{length:19},variants:{length:79},reviewedInventory:{length:75},inventoryExceptions:{length:4}});expect(catalog.variants.some(item=>item.sku==="TEST-VARIANT-001")).toBe(false);});
  it("reports BX price candidates without treating source inventory as a write",async()=>{const db:SqlExecutor={query:async sql=>{if(sql.includes("to_regclass"))return[{MappingTable:null}] as never;if(sql.includes("FROM dbo.Products"))return["SHIRT","TOTE","CAP"].map((name,index)=>({ProductId:index+1,SKU:`BX-${name}`})) as never;return[] as never;}};const plan=await planSharePointCatalogImport(db,await readSharePointCatalog(dir));expect(plan).toMatchObject({mappingReady:false,creates:{categories:5,products:19,variants:79},reviewedInventory:{rows:75,physical:1022,reserved:0,writes:0}});expect(plan.priceReview).toHaveLength(3);expect(plan.conflicts).toEqual([]);});
  it("uses installed provenance mappings even when Postgres lowercases result fields",async()=>{const db:SqlExecutor={query:async sql=>{if(sql.includes("to_regclass"))return[{mappingtable:"dbo.catalogimportmappings"}] as never;if(sql.includes("CatalogImportMappings"))return[{entitytype:"Category",externalid:"1",nativeid:8}] as never;if(sql.includes("FROM dbo.Categories"))return[{categoryid:8,categoryname:"SHS"}] as never;return[] as never;}};const plan=await planSharePointCatalogImport(db,await readSharePointCatalog(dir));expect(plan.mappingReady).toBe(true);expect(plan.updates.categories).toBe(1);expect(plan.creates.categories).toBe(4);expect(plan.conflicts).toEqual([]);});
});
