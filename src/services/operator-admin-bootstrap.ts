import {z} from "zod";
import type {SqlExecutor,SqlTransactionManager} from "../integrations/sql-server.js";
import {AppError} from "../lib/errors.js";

export const BULLDOGS_SUPABASE_PROJECT="qyzwruvggwxbmqrurmxh";
const inputSchema=z.object({projectRef:z.literal(BULLDOGS_SUPABASE_PROJECT),targetUserId:z.number().int().positive(),authUserId:z.string().uuid(),email:z.string().trim().email().transform(value=>value.toLowerCase()),schoolId:z.string().trim().min(3).max(50),confirmation:z.string()}).strict();
export type OperatorBootstrapInput=z.infer<typeof inputSchema>;
type AuthUser={id:string;email?:string};
type Row=Record<string,unknown>;

export async function verifyOperatorBootstrap(input:unknown,fetcher:typeof fetch=fetch){
  const parsed=inputSchema.safeParse(input);if(!parsed.success)throw new AppError("VALIDATION_ERROR",parsed.error.issues[0]?.message??"Invalid bootstrap input.");
  const value=parsed.data,expected=`PROMOTE ${value.email} TO INITIAL BULLDOGS XCHANGE ADMIN`;
  if(value.confirmation!==expected)throw new AppError("FORBIDDEN","Bootstrap confirmation phrase does not match.");
  const configured=process.env.SUPABASE_PROJECT_REF,url=process.env.SUPABASE_URL??(configured?`https://${configured}.supabase.co`:""),key=process.env.SUPABASE_SERVICE_ROLE_KEY,databaseUrl=process.env.SUPABASE_DATABASE_URL;
  if(configured!==BULLDOGS_SUPABASE_PROJECT||!url||new URL(url).hostname!==`${BULLDOGS_SUPABASE_PROJECT}.supabase.co`)throw new AppError("CONFIGURATION_ERROR","Bootstrap project does not match Bulldogs Xchange.");
  if(!databaseUrl||!decodeURIComponent(new URL(databaseUrl).username).endsWith(`.${BULLDOGS_SUPABASE_PROJECT}`))throw new AppError("CONFIGURATION_ERROR","Database connection does not match Bulldogs Xchange.");
  if(!key)throw new AppError("CONFIGURATION_ERROR","Supabase service-role credential is required.");
  const response=await fetcher(`${url}/auth/v1/admin/users/${encodeURIComponent(value.authUserId)}`,{headers:{apikey:key,authorization:`Bearer ${key}`}});
  if(!response.ok)throw new AppError("FORBIDDEN","The specified Supabase Auth identity could not be verified.");
  const identity=await response.json() as AuthUser;
  if(identity.id!==value.authUserId||identity.email?.trim().toLowerCase()!==value.email)throw new AppError("FORBIDDEN","Supabase Auth identity does not match the intended account.");
  return value;
}

export class OperatorAdminBootstrapService{
  constructor(private db:SqlTransactionManager){}
  promote(input:OperatorBootstrapInput){return this.db.transaction(async db=>{
    const admins=await db.query<Row>("SELECT u.UserId FROM dbo.Users u WITH (UPDLOCK,HOLDLOCK) JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.IsActive=1 AND r.RoleName='Admin'");
    if(admins.length)throw new AppError("CONFLICT","An active Admin already exists.");
    const rows=await db.query<Row>("SELECT u.UserId,u.SchoolId,u.FullName,u.Email,u.IsActive,r.RoleName FROM dbo.Users u WITH (UPDLOCK,HOLDLOCK) JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.UserId=@userId",{userId:input.targetUserId});
    const user=rows[0];
    if(!user||Number(user.UserId)!==input.targetUserId||String(user.Email).toLowerCase()!==input.email||String(user.SchoolId)!==input.schoolId||user.RoleName!=="Customer"||!user.IsActive)throw new AppError("FORBIDDEN","Database account does not match the intended active Customer.");
    await db.query("UPDATE dbo.Users SET RoleId=(SELECT RoleId FROM dbo.Roles WHERE RoleName='Admin'),UpdatedAt=SYSUTCDATETIME() WHERE UserId=@userId",{userId:input.targetUserId});
    await this.audit(db,input.targetUserId,input.email);
    return{id:String(input.targetUserId),email:input.email,role:"Admin" as const,isActive:true};
  });}
  private audit(db:SqlExecutor,userId:number,email:string){return db.query("INSERT dbo.AuditLogs(UserId,Action,Entity,EntityId,PreviousValue,NewValue) VALUES(@userId,'BootstrapAdmin','User',@entityId,@previous,@next)",{userId,entityId:String(userId),previous:JSON.stringify({role:"Customer"}),next:JSON.stringify({role:"Admin",email})});}
}
