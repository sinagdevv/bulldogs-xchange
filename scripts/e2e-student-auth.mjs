import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import {handle} from "../dist/src/app.js";

const ids={admin:"2026-0001",a:"E2E-20261009-A",b:"E2E-20261009-B"};
const emails={admin:"cacanantajrp@students.nu-fairview.edu.ph",a:process.env.BX_E2E_STUDENT_A_EMAIL,b:process.env.BX_E2E_STUDENT_B_EMAIL};
const passwords={admin:process.env.BX_E2E_ADMIN_PASSWORD,a:process.env.BX_E2E_STUDENT_A_PASSWORD,b:process.env.BX_E2E_STUDENT_B_PASSWORD};
const strong=value=>typeof value==="string"&&value.length>=12&&value.length<=128&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value)&&/[\W_]/.test(value);
for(const [name,value] of Object.entries(passwords))assert.ok(strong(value),`${name} password is missing or weak`);
for(const [name,value] of Object.entries(emails))assert.match(value??"",/^[^@\s]+@(students\.)?nu-fairview\.edu\.ph$/i,`${name} institutional email is missing or invalid`);
assert.equal(process.env.SUPABASE_PROJECT_REF,"qyzwruvggwxbmqrurmxh");

const pool=new pg.Pool({connectionString:process.env.SUPABASE_DATABASE_URL,ssl:{ca:fs.readFileSync(process.env.SUPABASE_CA_CERT_PATH,"utf8"),rejectUnauthorized:true},max:1});
const query=async(text,values=[])=>(await pool.query(text,values)).rows;
const api=async(method,path,body,token)=>{let status=0,payload;const res={status(value){status=value;return this},json(value){payload=value},setHeader(){},end(){}};await handle({method,url:`/api/${path}`,headers:token?{authorization:`Bearer ${token}`}:{},body},res);return{status,payload}};
const success=result=>result.payload?.success===true,result=result=>result.payload?.data;
const login=async(email,password)=>{const response=await api("POST","auth/login",{email,password});assert.equal(response.status,200,`login ${email}`);assert.ok(success(response));return result(response).accessToken};
const register=async(email,studentId,password,name)=>api("POST","auth/register",{email,studentId,password,confirmPassword:password,fullName:name});
const user=async studentId=>(await query("SELECT u.userid,u.schoolid,r.rolename,u.isactive,u.approvalstatus FROM dbo.users u JOIN dbo.roles r USING(roleid) WHERE lower(u.schoolid)=lower($1)",[studentId]))[0];
const snapshot=async()=>{const [row]=await query("SELECT (SELECT count(*)::int FROM dbo.reservations) reservations,(SELECT count(*)::int FROM dbo.notifications) notifications,(SELECT coalesce(sum(physicalquantity),0)::int FROM dbo.inventory) physical,(SELECT coalesce(sum(reservedquantity),0)::int FROM dbo.inventory) reserved");return row};
const checks={};
try{
  const existingA=await user(ids.a);if(existingA)assert.deepEqual({role:existingA.rolename,status:existingA.approvalstatus,active:existingA.isactive},{role:"Customer",status:"pending",active:true},"Student A is not in the resumable pending state");assert.equal((await user(ids.b)),undefined,"Student B already exists");
  const before=await snapshot(),adminToken=await login(emails.admin,passwords.admin);checks.adminEmailLogin=true;
  const adminAccess=await api("GET","admin/users",undefined,adminToken);assert.equal(adminAccess.status,200);checks.adminAccessBefore=true;

  if(!existingA){const createdA=await register(emails.a,ids.a,passwords.a,"Bulldogs E2E Student A");assert.equal(createdA.status,201);}checks.registerA=true;
  const rowA=await user(ids.a);assert.deepEqual({role:rowA.rolename,status:rowA.approvalstatus,active:rowA.isactive},{role:"Customer",status:"pending",active:true});assert.notEqual(rowA.userid,30);checks.pendingA=true;
  const pendingToken=await login(emails.a,passwords.a);
  const pendingMe=await api("GET","me",undefined,pendingToken),pendingReservation=await api("POST","reservations",{},pendingToken);assert.equal(pendingMe.status,403);assert.equal(pendingReservation.status,403);checks.pendingDenied=true;
  const duplicate=await register(`  ${emails.a.toUpperCase()}  `,ids.a,passwords.a,"Duplicate Student");assert.equal(duplicate.status,409);checks.duplicateRejected=true;

  const approved=await api("PUT",`admin/users/${rowA.userid}/approval`,{status:"approved"},adminToken);assert.equal(approved.status,200);checks.approvedA=true;
  const [approvalAudit]=await query("SELECT count(*)::int count FROM dbo.approvalhistory WHERE accountuserid=$1 AND action='approved' AND actingadminuserid=30",[rowA.userid]);assert.equal(approvalAudit.count,1);checks.approvalHistory=true;
  const approvedToken=await login(emails.a,passwords.a),approvedMe=await api("GET","me",undefined,approvedToken);assert.equal(approvedMe.status,200);assert.equal(result(approvedMe).role,"Customer");checks.approvedAccess=true;
  const suspended=await api("PUT",`admin/users/${rowA.userid}/approval`,{status:"suspended",reason:"E2E suspension test"},adminToken);assert.equal(suspended.status,200);const suspendedMe=await api("GET","me",undefined,approvedToken);assert.equal(suspendedMe.status,403);checks.suspensionInvalidatesSession=true;

  const createdB=await register(emails.b,ids.b,passwords.b,"Bulldogs E2E Student B");assert.equal(createdB.status,201);const rowB=await user(ids.b);assert.notEqual(rowB.userid,30);checks.registerB=true;
  const rejected=await api("PUT",`admin/users/${rowB.userid}/approval`,{status:"rejected",reason:"E2E rejection test"},adminToken);assert.equal(rejected.status,200);const rejectedToken=await login(emails.b,passwords.b),rejectedMe=await api("GET","me",undefined,rejectedToken);assert.equal(rejectedMe.status,403);checks.rejectedDenied=true;
  const wrong=await api("POST","auth/login",{email:emails.b,password:"DefinitelyWrong1!"});assert.equal(wrong.status,401);checks.wrongPassword=true;
  const loggedOut=await api("GET","session");assert.equal(loggedOut.status,200);assert.equal(result(loggedOut).authenticated,false);checks.logoutSession=true;

  const adminAfter=await user(ids.admin);assert.deepEqual({id:adminAfter.userid,role:adminAfter.rolename,active:adminAfter.isactive,status:adminAfter.approvalstatus},{id:30,role:"Admin",active:true,status:"approved"});const adminAccessAfter=await api("GET","admin/users",undefined,adminToken);assert.equal(adminAccessAfter.status,200);checks.adminIntact=true;
  const after=await snapshot();assert.deepEqual(after,before);checks.businessDataConsistent=true;
  console.log(JSON.stringify({checks,studentA:{id:rowA.userid,finalStatus:"suspended"},studentB:{id:rowB.userid,finalStatus:"rejected"},recordsDeleted:false,reservationsCreated:false},null,2));
}finally{delete process.env.BX_E2E_ADMIN_PASSWORD;delete process.env.BX_E2E_STUDENT_A_PASSWORD;delete process.env.BX_E2E_STUDENT_B_PASSWORD;await pool.end();}
