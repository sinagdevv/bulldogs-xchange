import {readFile} from "node:fs/promises";
import {PostgresConnectionManager} from "../integrations/postgres.js";
import {OperatorAccountProvisioningService} from "../services/operator-account-provisioning.js";
import {BULLDOGS_SUPABASE_PROJECT} from "../services/operator-admin-bootstrap.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>value.split("=",2) as [string,string]));
if(args["--operator-provisioning"]!=="true"||!args["--accounts-file"]||!args["--confirm"])throw new Error("Required: --operator-provisioning=true --accounts-file=<path> --confirm=<exact phrase> [--dry-run=true]");
const accounts=JSON.parse(await readFile(args["--accounts-file"],"utf8")) as unknown;
const db=new PostgresConnectionManager();
try{const result=await new OperatorAccountProvisioningService(db).run({projectRef:BULLDOGS_SUPABASE_PROJECT,operatorProvisioning:true,confirmation:args["--confirm"],dryRun:args["--dry-run"]!=="false",accounts});for(const item of result.results)console.log(`${item.label}: ${item.status}`);}finally{await db.closePool();}
