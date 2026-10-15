import {PostgresConnectionManager} from "../integrations/postgres.js";
import {OperatorAdminBootstrapService,verifyOperatorBootstrap} from "../services/operator-admin-bootstrap.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const[key,...rest]=value.replace(/^--/,"").split("=");return[key,decodeURIComponent(rest.join("="))]}));
const input={projectRef:args["project-ref"],targetUserId:Number(args["user-id"]),authUserId:args["auth-user-id"],email:args.email,schoolId:args["school-id"],confirmation:args.confirm};
const verified=await verifyOperatorBootstrap(input);
const db=new PostgresConnectionManager();
try{const user=await new OperatorAdminBootstrapService(db).promote(verified);console.log(`Initial Admin ready: ${user.email} (user ${user.id}).`);}finally{await db.closePool();}
