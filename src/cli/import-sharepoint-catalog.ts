import {PostgresConnectionManager} from "../integrations/postgres.js";
import {assertApprovedCatalogDatabase,readSharePointCatalog,SharePointCatalogImportService} from "../services/sharepoint-catalog-import-service.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>value.split("=",2) as [string,string]));
const apply=args["--apply"]==="true", catalogDir=args["--catalog-dir"]??"data/sharepoint-import";
if(apply&&(args["--confirm"]!=="IMPORT_SHAREPOINT_CATALOG_METADATA"||!args["--actor-user-id"]))throw new Error("Apply requires --confirm=IMPORT_SHAREPOINT_CATALOG_METADATA --actor-user-id=<active Admin id> --approve-price-review=true.");
assertApprovedCatalogDatabase();
const db=new PostgresConnectionManager();
try{const catalog=await readSharePointCatalog(catalogDir),service=new SharePointCatalogImportService(db),plan=await service.plan(catalog);if(apply){if(args["--approve-price-review"]!=="true")throw new Error("Apply requires --approve-price-review=true after reviewing BX SKU candidates.");await service.apply(catalog,Number(args["--actor-user-id"]),true);}console.log(JSON.stringify({mode:apply?"apply":"dry-run",plan},null,2));}finally{await db.closePool();}
