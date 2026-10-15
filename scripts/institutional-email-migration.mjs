import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {chmodSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import pg from "pg";

const mode=process.argv[2]??"preflight",expectedRef="qyzwruvggwxbmqrurmxh";
assert.ok(["preflight","apply","verify"].includes(mode),"Use preflight, apply, or verify");
assert.equal(process.env.SUPABASE_PROJECT_REF,expectedRef,"Unexpected Supabase project");
assert.notEqual(process.env.ENABLE_INSTITUTIONAL_EMAIL_REGISTRATION,"true","Registration must remain disabled");
const connectionString=process.env.SUPABASE_DATABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(connectionString&&key,"Supabase migration environment is incomplete");
const migrationPath=resolve("supabase/migrations/20261010090000_institutional_email_auth.sql"),migration=readFileSync(migrationPath,"utf8");
const activeSql=migration.replace(/^\s*--.*$/gm,"");
assert.equal(/\b(insert|update|delete|truncate)\b/i.test(activeSql),false,"Migration contains data modification");
assert.equal((activeSql.match(/CREATE UNIQUE INDEX/gi)??[]).length,1,"Expected one unique index");
assert.equal((activeSql.match(/ADD CONSTRAINT/gi)??[]).length,1,"Expected one constraint");
const pool=new pg.Pool({connectionString,ssl:{ca:process.env.SUPABASE_CA_CERT_PATH?readFileSync(process.env.SUPABASE_CA_CERT_PATH,"utf8"):undefined,rejectUnauthorized:true},max:1});
const query=(text,values)=>pool.query(text,values).then(result=>result.rows);
const digest=value=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const snapshot=async()=>{
  const [users,admin,relationships,inventory,reservations,notifications,audits,authResponse]=await Promise.all([
    query("SELECT u.userid,u.schoolid,u.email,u.schoolemail,u.authsubject,u.roleid,u.approvalstatus,u.isactive,r.rolename FROM dbo.users u JOIN dbo.roles r USING(roleid) ORDER BY u.userid"),
    query("SELECT u.userid,u.schoolid,u.email,u.schoolemail,u.authsubject,u.approvalstatus,u.isactive,r.rolename FROM dbo.users u JOIN dbo.roles r USING(roleid) WHERE u.userid=30"),
    query("SELECT (SELECT count(*)::int FROM dbo.reservations WHERE customerid=30) reservations,(SELECT count(*)::int FROM dbo.notifications WHERE recipientuserid=30) notifications,(SELECT count(*)::int FROM dbo.auditlogs WHERE userid=30) audits"),
    query("SELECT * FROM dbo.inventory ORDER BY productvariantid"),query("SELECT * FROM dbo.reservations ORDER BY reservationid"),query("SELECT * FROM dbo.notifications ORDER BY notificationid"),query("SELECT * FROM dbo.auditlogs ORDER BY auditlogid"),
    fetch(`https://${expectedRef}.supabase.co/auth/v1/admin/users?per_page=1000`,{headers:{apikey:key,authorization:`Bearer ${key}`}})
  ]);
  assert.equal(authResponse.ok,true,"Supabase Auth metadata lookup failed");
  const authUsers=(await authResponse.json()).users??[],safeAuth=authUsers.map(user=>({id:user.id,email:user.email,emailConfirmedAt:user.email_confirmed_at??null,createdAt:user.created_at??null,lastSignInAt:user.last_sign_in_at??null})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return{users,admin:admin[0],relationships:relationships[0],hashes:{users:digest(users),inventory:digest(inventory),reservations:digest(reservations),notifications:digest(notifications),audits:digest(audits),auth:digest(safeAuth)},auth:safeAuth};
};

try{
  const [schema,duplicates,identityIssues,constraint,index,before]=await Promise.all([
    query("SELECT current_database() database,current_user database_user,to_regclass('dbo.users') users_table,(SELECT data_type FROM information_schema.columns WHERE table_schema='dbo' AND table_name='users' AND column_name='schoolemail') school_email_type"),
    query(`SELECT canonical_email,count(*)::int count FROM (SELECT lower(btrim(COALESCE(NULLIF(btrim(schoolemail),''),CASE WHEN lower(btrim(email)) ~ '^[^@[:space:]]+@(students\\.)?nu-fairview\\.edu\\.ph$' THEN email END))) canonical_email FROM dbo.users) c WHERE canonical_email IS NOT NULL GROUP BY canonical_email HAVING count(*)>1`),
    query("SELECT count(*)::int count FROM dbo.users u WHERE u.authsubject IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id=u.authsubject)"),
    query("SELECT conname,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='dbo.users'::regclass AND conname='ck_users_schoolemail_institutional_domain'"),
    query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='dbo' AND tablename='users' AND indexname='uq_users_institutional_email_normalized'"),snapshot()
  ]);
  assert.equal(schema[0]?.users_table,"dbo.users","dbo.users is missing");
  assert.equal(schema[0]?.school_email_type,"character varying","Unexpected SchoolEmail type");
  assert.equal(duplicates.length,0,"Normalized institutional-email collision found");
  assert.equal(identityIssues[0]?.count,0,"Stored AuthSubject mismatch found");
  assert.deepEqual({userid:before.admin?.userid,schoolid:before.admin?.schoolid,rolename:before.admin?.rolename,approvalstatus:before.admin?.approvalstatus,isactive:before.admin?.isactive},{userid:30,schoolid:"2026-0001",rolename:"Admin",approvalstatus:"approved",isactive:true});
  const adminAuth=before.auth.find(user=>user.id===String(before.admin?.authsubject))??before.auth.find(user=>user.email?.trim().toLowerCase()===String(before.admin?.email).trim().toLowerCase());
  assert.ok(adminAuth,"Admin Auth identity was not found");
  if(mode==="preflight"){
    assert.equal(constraint.length,0,"Constraint already exists");assert.equal(index.length,0,"Index already exists");
    const backupPath=resolve(`backups/auth-migrations/20261010090000-preflight-${new Date().toISOString().replaceAll(":","-")}.json`);mkdirSync(dirname(backupPath),{recursive:true});writeFileSync(backupPath,JSON.stringify({projectRef:expectedRef,migration:"20261010090000_institutional_email_auth.sql",createdAt:new Date().toISOString(),...before},null,2),{mode:0o600});chmodSync(backupPath,0o600);
    console.log(JSON.stringify({status:"PASS",projectRef:expectedRef,migrationHash:digest(migration),users:before.users.length,duplicates:0,authSubjectMismatches:0,admin:{userid:30,role:"Admin",approval:"approved",active:true,authIdentity:"verified"},relationships:before.relationships,registrationEnabled:false,constraintPresent:false,indexPresent:false,backupPath},null,2));
  }else if(mode==="apply"){
    assert.equal(constraint.length,0,"Constraint already exists");assert.equal(index.length,0,"Index already exists");await pool.query(migration);const after=await snapshot();for(const key of Object.keys(before.hashes))assert.equal(after.hashes[key],before.hashes[key],`${key} changed`);console.log(JSON.stringify({status:"APPLIED",projectRef:expectedRef,migration:"20261010090000_institutional_email_auth.sql",migrationHash:digest(migration),unchanged:{users:true,inventory:true,reservations:true,notifications:true,audits:true,authMetadata:true}}));
  }else{
    assert.equal(constraint.length,1,"Constraint missing");assert.equal(constraint[0].convalidated,true,"Constraint is not valid");assert.equal(index.length,1,"Index missing");const after=await snapshot();assert.equal(after.hashes.users,before.hashes.users);assert.equal(after.hashes.inventory,before.hashes.inventory);assert.equal(after.hashes.reservations,before.hashes.reservations);assert.equal(after.hashes.notifications,before.hashes.notifications);assert.equal(after.hashes.audits,before.hashes.audits);assert.equal(after.hashes.auth,before.hashes.auth);console.log(JSON.stringify({status:"PASS",projectRef:expectedRef,constraint:{name:constraint[0].conname,valid:constraint[0].convalidated},index:{name:index[0].indexname},users:after.users.length,admin:{userid:30,role:after.admin.rolename,approval:after.admin.approvalstatus,active:after.admin.isactive,authIdentity:"verified"},relationships:after.relationships,unchanged:{users:true,inventory:true,reservations:true,notifications:true,audits:true,authMetadata:true},registrationEnabled:false},null,2));
  }
}finally{await pool.end();}
