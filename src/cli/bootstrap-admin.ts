import {PostgresConnectionManager} from "../integrations/postgres.js";
import {OperatorAdminBootstrapService,verifyOperatorBootstrap} from "../services/operator-admin-bootstrap.js";
import {parseBootstrapAdminArgs} from "./bootstrap-admin-args.js";

const input=parseBootstrapAdminArgs(process.argv.slice(2));
const verified=await verifyOperatorBootstrap(input);
const db=new PostgresConnectionManager();
try{const user=await new OperatorAdminBootstrapService(db).promote(verified);console.log(`Initial Admin ready: ${user.email} (user ${user.id}).`);}finally{await db.closePool();}
