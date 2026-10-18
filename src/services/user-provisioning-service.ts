import {z} from "zod";
import type {AuthenticatedPrincipal} from "../auth/auth-provider.js";
import type {User} from "../domain/models.js";
import type {SqlExecutor,SqlTransactionManager} from "../integrations/sql-server.js";
import {AppError} from "../lib/errors.js";
import {mapUser} from "../repositories/sql-server-repository.js";

type Row=Record<string,unknown>;
const customerSchema=z.object({schoolId:z.string().trim().min(3).max(50).optional(),fullName:z.string().trim().min(2).max(200).optional(),departmentId:z.coerce.number().int().positive().optional(),customerType:z.string().trim().min(1).max(100).optional()}).strict();
const userSql="SELECT u.UserId,u.SchoolId,u.FullName,u.Email,u.SchoolEmail,u.AuthSubject,u.ApprovalStatus,u.RejectionReason,d.DepartmentName,r.RoleName,u.CustomerType,u.IsActive FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId LEFT JOIN dbo.Departments d ON d.DepartmentId=u.DepartmentId";

export class UserProvisioningService{
  constructor(private db:SqlTransactionManager){}
  registerCustomer(identity:AuthenticatedPrincipal,input:unknown){
    const value=customerSchema.safeParse(input);if(!value.success)throw new AppError("VALIDATION_ERROR",value.error.issues[0]?.message??"Invalid profile.");
    const google=identity.provider==="google",email=identity.email.trim().toLowerCase(),data={...value.data,schoolId:value.data.schoolId??null,fullName:value.data.fullName??identity.displayName?.trim()??email.split("@")[0]??"Customer",customerType:value.data.customerType??(google?"Google":"Email")};
    if(identity.provider!=="google"&&identity.provider!=="email"&&!email.endsWith("@students.nu-fairview.edu.ph"))throw new AppError("FORBIDDEN","Customer registration requires a verified Google or NU Fairview identity.");
    return this.db.transaction(async db=>{
      const existing=(await db.query<Row>(`${userSql} WHERE LOWER(u.Email)=LOWER(CAST(@email AS varchar(320))) OR u.AuthSubject=CAST(@authSubject AS uuid) OR (CAST(@schoolId AS varchar(50)) IS NOT NULL AND u.SchoolId=CAST(@schoolId AS varchar(50)))`,{email,authSubject:identity.subject,schoolId:data.schoolId}))[0];
      if(existing){if(String(existing.AuthSubject??existing.authSubject??"")===identity.subject)return mapUser(existing);throw new AppError("CONFLICT","Account identity is already registered.");}
      if(data.departmentId&&!(await db.query("SELECT DepartmentId FROM dbo.Departments WHERE DepartmentId=@departmentId AND IsActive=1",{departmentId:data.departmentId})).length)throw new AppError("VALIDATION_ERROR","Department is not active.");
      const rows=await db.query<Row>(`INSERT dbo.Users(SchoolId,FullName,Email,AuthSubject,DepartmentId,RoleId,CustomerType,ApprovalStatus,IsActive) OUTPUT INSERTED.UserId VALUES(@schoolId,@fullName,@email,@authSubject,@departmentId,(SELECT RoleId FROM dbo.Roles WHERE RoleName='Customer'),@customerType,'pending',true)`,{...data,email,authSubject:identity.subject,departmentId:data.departmentId??null});
      const id=rows[0]?.UserId;if(id==null)throw new AppError("EXTERNAL_SERVICE_ERROR","Account could not be created.");
      await this.audit(db,Number(id),"RegisterCustomer",String(id),{provider:identity.provider??"email",role:"Customer",approvalStatus:"pending"});
      return this.load(db,email);
    });
  }
  private async load(db:SqlExecutor,email:string):Promise<User>{const row=(await db.query<Row>(`${userSql} WHERE u.Email=@email`,{email}))[0];if(!row)throw new AppError("EXTERNAL_SERVICE_ERROR","Created account could not be loaded.");return mapUser(row);}
  private audit(db:SqlExecutor,userId:number,action:string,entityId:string,next:unknown,previous?:unknown){return db.query("INSERT dbo.AuditLogs(UserId,Action,Entity,EntityId,PreviousValue,NewValue) VALUES(@userId,@action,'User',@entityId,@previous,@next)",{userId,action,entityId,previous:previous===undefined?null:JSON.stringify(previous),next:JSON.stringify(next)});}
}
