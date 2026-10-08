import {z} from "zod";
import type {AuthenticatedPrincipal} from "../auth/auth-provider.js";
import type {User} from "../domain/models.js";
import type {SqlExecutor,SqlTransactionManager} from "../integrations/sql-server.js";
import {AppError} from "../lib/errors.js";
import {mapUser} from "../repositories/sql-server-repository.js";

type Row=Record<string,unknown>;
const customerSchema=z.object({schoolId:z.string().trim().min(3).max(50),fullName:z.string().trim().min(2).max(200),departmentId:z.coerce.number().int().positive().optional(),customerType:z.string().trim().min(1).max(100)}).strict();
const adminSchema=z.object({email:z.string().trim().email().transform(v=>v.toLowerCase()),schoolId:z.string().trim().min(3).max(50),fullName:z.string().trim().min(2).max(200)}).strict();
const userSql="SELECT u.UserId,u.SchoolId,u.FullName,u.Email,d.DepartmentName,r.RoleName,u.CustomerType,u.IsActive FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId LEFT JOIN dbo.Departments d ON d.DepartmentId=u.DepartmentId";

export class UserProvisioningService{
  constructor(private db:SqlTransactionManager){}
  registerCustomer(identity:AuthenticatedPrincipal,input:unknown){
    const value=customerSchema.safeParse(input);if(!value.success)throw new AppError("VALIDATION_ERROR",value.error.issues[0]?.message??"Invalid profile.");
    return this.db.transaction(async db=>{
      if((await db.query(`${userSql} WHERE LOWER(u.Email)=LOWER(@email) OR u.SchoolId=@schoolId`,{email:identity.email,schoolId:value.data.schoolId})).length)throw new AppError("CONFLICT","Email or school ID is already registered.");
      if(value.data.departmentId&&!(await db.query("SELECT DepartmentId FROM dbo.Departments WHERE DepartmentId=@departmentId AND IsActive=1",{departmentId:value.data.departmentId})).length)throw new AppError("VALIDATION_ERROR","Department is not active.");
      const rows=await db.query<Row>(`INSERT dbo.Users(SchoolId,FullName,Email,DepartmentId,RoleId,CustomerType,IsActive) OUTPUT INSERTED.UserId VALUES(@schoolId,@fullName,@email,@departmentId,(SELECT RoleId FROM dbo.Roles WHERE RoleName='Customer'),@customerType,1)`,{...value.data,email:identity.email,departmentId:value.data.departmentId??null});
      const id=rows[0]?.UserId;if(id==null)throw new AppError("EXTERNAL_SERVICE_ERROR","Account could not be created.");
      await this.audit(db,Number(id),"RegisterCustomer",String(id),{email:identity.email,role:"Customer"});
      return this.load(db,identity.email);
    });
  }
  bootstrapAdmin(identity:AuthenticatedPrincipal,input:{email:string;schoolId:string;fullName:string}){
    const parsed=adminSchema.safeParse(input);if(!parsed.success)throw new AppError("VALIDATION_ERROR",parsed.error.issues[0]?.message??"Invalid Admin profile.");
    input=parsed.data;const email=input.email;
    if(identity.email!==email)throw new AppError("FORBIDDEN","Token identity does not match the selected email.");
    return this.db.transaction(async db=>{
      const existing=(await db.query<Row>(`${userSql} WHERE LOWER(u.Email)=LOWER(@email) OR u.SchoolId=@schoolId`,{email,schoolId:input.schoolId})).map(mapUser);
      const admins=await db.query<Row>("SELECT u.UserId FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.IsActive=1 AND r.RoleName='Admin'");
      if(existing.length===1&&existing[0]!.email.toLowerCase()===email&&existing[0]!.schoolId===input.schoolId&&existing[0]!.role==="Admin"&&existing[0]!.isActive)return existing[0]!;
      if(admins.length)throw new AppError("CONFLICT","An active Admin already exists.");
      if(existing.length)throw new AppError("CONFLICT","Email or school ID is already registered.");
      const rows=await db.query<Row>(`INSERT dbo.Users(SchoolId,FullName,Email,RoleId,IsActive) OUTPUT INSERTED.UserId VALUES(@schoolId,@fullName,@email,(SELECT RoleId FROM dbo.Roles WHERE RoleName='Admin'),1)`,{...input,email});
      const id=Number(rows[0]?.UserId);if(!id)throw new AppError("EXTERNAL_SERVICE_ERROR","Admin could not be created.");
      await this.audit(db,id,"BootstrapAdmin",String(id),{email,role:"Admin"});
      return this.load(db,email);
    });
  }
  private async load(db:SqlExecutor,email:string):Promise<User>{const row=(await db.query<Row>(`${userSql} WHERE u.Email=@email`,{email}))[0];if(!row)throw new AppError("EXTERNAL_SERVICE_ERROR","Created account could not be loaded.");return mapUser(row);}
  private audit(db:SqlExecutor,userId:number,action:string,entityId:string,next:unknown){return db.query("INSERT dbo.AuditLogs(UserId,Action,Entity,EntityId,NewValue) VALUES(@userId,@action,'User',@entityId,@next)",{userId,action,entityId,next:JSON.stringify(next)});}
}
