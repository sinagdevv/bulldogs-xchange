import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import pg from "pg";

const connectionString=process.env.SUPABASE_DATABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,ref=process.env.SUPABASE_PROJECT_REF;
assert.ok(connectionString&&key&&ref,"Supabase preflight environment is incomplete");
const pool=new pg.Pool({connectionString,ssl:{ca:process.env.SUPABASE_CA_CERT_PATH?readFileSync(process.env.SUPABASE_CA_CERT_PATH,"utf8"):undefined,rejectUnauthorized:true},max:1});
const institutional=email=>/^[^@]+@(students\.)?nu-fairview\.edu\.ph$/i.test(email??"");
const normalize=email=>email?.trim().toLowerCase()||null;

try{
  const users=(await pool.query(`SELECT u.userid,u.schoolid,u.email,u.schoolemail,u.authsubject,u.isactive,u.approvalstatus,r.rolename
    FROM dbo.users u JOIN dbo.roles r USING(roleid) ORDER BY u.userid`)).rows;
  const authResponse=await fetch(`https://${ref}.supabase.co/auth/v1/admin/users?per_page=1000`,{headers:{apikey:key,authorization:`Bearer ${key}`}});
  assert.equal(authResponse.ok,true,"Supabase Auth user listing failed");
  const authUsers=(await authResponse.json()).users??[];
  const authById=new Map(authUsers.map(user=>[user.id,user])),authByEmail=new Map(authUsers.map(user=>[normalize(user.email),user]));
  const mapped=users.map(user=>{const email=normalize(user.email),schoolEmail=normalize(user.schoolemail),auth=user.authsubject?authById.get(String(user.authsubject)):authByEmail.get(email);return{userId:user.userid,schoolId:user.schoolid,role:user.rolename,approvalStatus:user.approvalstatus,isActive:user.isactive,authEmailKind:email?.endsWith("@auth.bulldogs-xchange.invalid")?"hmac-alias":institutional(email)?"institutional":"other",institutionalEmailMapped:institutional(schoolEmail)||institutional(email),authSubjectStored:!!user.authsubject,authIdentityFound:!!auth,authIdentityMatches:!!auth&&normalize(auth.email)===email};});
  const addresses=users.flatMap(user=>[[user.userid,"email",normalize(user.email)],[user.userid,"schoolEmail",normalize(user.schoolemail)]]).filter(([,column,email])=>email&&institutional(email)&&column);
  const groups=Map.groupBy(addresses,row=>row[2]);
  const duplicates=[...groups.values()].filter(rows=>new Set(rows.map(row=>row[0])).size>1);
  const crossColumnCollisions=duplicates.filter(rows=>new Set(rows.map(row=>row[1])).size>1);
  const constraints=(await pool.query(`SELECT conname,pg_get_constraintdef(oid) definition,convalidated
    FROM pg_constraint WHERE connamespace='dbo'::regnamespace AND conname='ck_users_schoolemail_institutional_domain'`)).rows;
  const indexes=(await pool.query(`SELECT indexname,indexdef FROM pg_indexes
    WHERE schemaname='dbo' AND indexname='uq_users_institutional_email_normalized'`)).rows;
  const admin=mapped.find(user=>user.userId===30);
  assert.deepEqual({schoolId:admin?.schoolId,role:admin?.role,approvalStatus:admin?.approvalStatus,isActive:admin?.isActive,authIdentityFound:admin?.authIdentityFound,authIdentityMatches:admin?.authIdentityMatches},{schoolId:"2026-0001",role:"Admin",approvalStatus:"approved",isActive:true,authIdentityFound:true,authIdentityMatches:true});
  console.log(JSON.stringify({projectRef:ref,userCount:users.length,accounts:mapped,duplicateInstitutionalEmails:duplicates.length,crossColumnCollisions:crossColumnCollisions.length,hmacAliasesWithoutInstitutionalEmail:mapped.filter(user=>user.authEmailKind==="hmac-alias"&&!user.institutionalEmailMapped).length,authIdentityMismatches:mapped.filter(user=>!user.authIdentityFound||!user.authIdentityMatches).length,constraints,indexes,adminPreservation:"PASS"},null,2));
}finally{
  await pool.end();
}
