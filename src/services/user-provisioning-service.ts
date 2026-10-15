import {z} from "zod";
import type {AuthenticatedPrincipal} from "../auth/auth-provider.js";
import type {User} from "../domain/models.js";
import type {SqlExecutor,SqlTransactionManager} from "../integrations/sql-server.js";
import {AppError} from "../lib/errors.js";
import {mapUser} from "../repositories/sql-server-repository.js";

type Row=Record<string,unknown>;
const customerSchema=z.object({schoolId:z.string().trim().min(3).max(50),fullName:z.string().trim().min(2).max(200),departmentId:z.coerce.number().int().positive().optional(),customerType:z.string().trim().min(1).max(100)}).strict();
const userSql="SELECT u.UserId,u.SchoolId,u.FullName,u.Email,d.DepartmentName,r.RoleName,u.CustomerType,u.IsActive FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId LEFT JOIN dbo.Departments d ON d.DepartmentId=u.DepartmentId";

export class UserProvisioningService{
  constructor(private db:SqlTransactionManager){}
  registerCustomer(identity:AuthenticatedPrincipal,input:unknown){
    const value=customerSchema.safeParse(input);if(!value.success)throw new AppError("VALIDATION_ERROR",value.error.issues[0]?.message??"Invalid profile.");
    if(!identity.email.endsWith("@students.nu-fairview.edu.ph"))throw new AppError("FORBIDDEN","Customer registration requires an NU Fairview student email.");
    return this.db.transaction(async db=>{
      if((await db.query(`${userSql} WHERE LOWER(u.Email)=LOWER(@email) OR u.SchoolId=@schoolId`,{email:identity.email,schoolId:value.data.schoolId})).length)throw new AppError("CONFLICT","Email or school ID is already registered.");
      if(value.data.departmentId&&!(await db.query("SELECT DepartmentId FROM dbo.Departments WHERE DepartmentId=@departmentId AND IsActive=1",{departmentId:value.data.departmentId})).length)throw new AppError("VALIDATION_ERROR","Department is not active.");
      const rows=await db.query<Row>(`INSERT dbo.Users(SchoolId,FullName,Email,DepartmentId,RoleId,CustomerType) OUTPUT INSERTED.UserId VALUES(@schoolId,@fullName,@email,@departmentId,(SELECT RoleId FROM dbo.Roles WHERE RoleName='Customer'),@customerType)`,{...value.data,email:identity.email,departmentId:value.data.departmentId??null});
      const id=rows[0]?.UserId;if(id==null)throw new AppError("EXTERNAL_SERVICE_ERROR","Account could not be created.");
      await this.audit(db,Number(id),"RegisterCustomer",String(id),{email:identity.email,role:"Customer"});
      return this.load(db,identity.email);
    });
  }
  private async load(db:SqlExecutor,email:string):Promise<User>{const row=(await db.query<Row>(`${userSql} WHERE u.Email=@email`,{email}))[0];if(!row)throw new AppError("EXTERNAL_SERVICE_ERROR","Created account could not be loaded.");return mapUser(row);}
  private audit(db:SqlExecutor,userId:number,action:string,entityId:string,next:unknown,previous?:unknown){return db.query("INSERT dbo.AuditLogs(UserId,Action,Entity,EntityId,PreviousValue,NewValue) VALUES(@userId,@action,'User',@entityId,@previous,@next)",{userId,action,entityId,previous:previous===undefined?null:JSON.stringify(previous),next:JSON.stringify(next)});}
}
