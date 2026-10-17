import {readFile} from "node:fs/promises";
import {PostgresConnectionManager} from "../integrations/postgres.js";
import {OperatorAccountProvisioningService} from "../services/operator-account-provisioning.js";
import {BULLDOGS_SUPABASE_PROJECT} from "../services/operator-admin-bootstrap.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>value.split("=",2) as [string,string]));
if(args["--operator-provisioning"]!=="true"||!args["--account-file"]||!args["--confirm"])throw new Error("Required: --operator-provisioning=true --account-file=<gitignored path> --confirm=<exact phrase> [--dry-run=true]");
const input=JSON.parse(await readFile(args["--account-file"],"utf8")) as Record<string,unknown>;
const db=new PostgresConnectionManager();
try{const result=await new OperatorAccountProvisioningService(db).runSingle({projectRef:BULLDOGS_SUPABASE_PROJECT,operatorProvisioning:true,confirmation:args["--confirm"],dryRun:args["--dry-run"]!=="false",authorizedBy:input.authorizedBy,authorizationReference:input.authorizationReference,account:{email:input.email,fullName:input.fullName,studentId:input.studentId}});console.log(`Admin: ${result.result.status}`);}finally{await db.closePool();}
