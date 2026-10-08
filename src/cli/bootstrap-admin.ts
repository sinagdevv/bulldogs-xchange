import {OidcAuthProvider} from "../auth/auth-provider.js";
import {PostgresConnectionManager} from "../integrations/postgres.js";
import {UserProvisioningService} from "../services/user-provisioning-service.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,"").split("=");return[key,rest.join("=")]}));
const email=args.email?.trim().toLowerCase(),schoolId=args["school-id"]?.trim(),fullName=args.name?.trim(),approval=args.approve?.trim(),token=process.env.AUTH0_BOOTSTRAP_TOKEN;
if(!email||!schoolId||!fullName||approval!==`CREATE INITIAL ADMIN ${email}`||!token)throw new Error("Required: --email, --school-id, --name, --approve=\"CREATE INITIAL ADMIN <email>\", and AUTH0_BOOTSTRAP_TOKEN.");
const db=new PostgresConnectionManager();
try{const identity=await new OidcAuthProvider().authenticate({headers:{authorization:`Bearer ${token}`}});if(!identity)throw new Error("Verified Auth0 identity required.");const user=await new UserProvisioningService(db).bootstrapAdmin(identity,{email,schoolId,fullName});console.log(`Initial Admin ready: ${user.email} (user ${user.id}).`);}finally{await db.closePool();}
