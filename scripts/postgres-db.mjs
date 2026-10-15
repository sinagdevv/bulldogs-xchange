import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {readFileSync} from "node:fs";
import pg from "pg";
const command=process.argv[2],connectionString=process.env.SUPABASE_DATABASE_URL;
if(!connectionString){console.log("SKIP: set SUPABASE_DATABASE_URL to run Postgres integration commands.");process.exit(0);}
const operationalProject="miwodndxgrdyanrloxig",projectRef=process.env.SUPABASE_PROJECT_REF,expectedRef=process.env.HOSTED_DEMO_SUPABASE_PROJECT_REF;
if(projectRef===operationalProject||connectionString.includes(operationalProject))throw new Error("Refusing the operational Supabase project.");
if(command==="schema"||command==="seed"){
  if(!expectedRef)throw new Error("HOSTED_DEMO_SUPABASE_PROJECT_REF is required before schema or seed commands.");
  if(expectedRef===operationalProject||projectRef!==expectedRef)throw new Error("Hosted demo Supabase project identity does not match the approved target.");
  const target=new URL(connectionString);
  if(!target.hostname.includes(expectedRef)&&!target.username.includes(expectedRef))throw new Error("Hosted demo database URL does not identify the approved Supabase project.");
}
const ca=process.env.SUPABASE_CA_CERT_PATH;
const pool=new pg.Pool({connectionString,ssl:process.env.POSTGRES_SSL==="false"?false:{ca:ca?readFileSync(ca,"utf8"):undefined,rejectUnauthorized:true},max:Number(process.env.POSTGRES_POOL_MAX??3)});
try{
  if(command==="schema"||command==="seed") await pool.query(await readFile(new URL(command==="schema"?"../database/postgres/001_normalized_schema.sql":"../database/postgres/002_demo_seed.sql",import.meta.url),"utf8"));
  else if(command==="integrity"){const {rows:[r]}=await pool.query(`SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='dbo') tables,(SELECT count(*) FROM dbo.products p LEFT JOIN dbo.categories c USING(categoryid) WHERE c.categoryid IS NULL) orphan_products,(SELECT count(*) FROM dbo.inventory WHERE physicalquantity<0 OR reservedquantity<0 OR reservedquantity>physicalquantity) invalid_inventory,(SELECT count(*) FROM dbo.users u JOIN dbo.roles r USING(roleid) WHERE u.isactive AND r.rolename='Admin') active_admins`);assert.ok(Number(r.tables)>=22);assert.equal(Number(r.orphan_products),0);assert.equal(Number(r.invalid_inventory),0);assert.ok(Number(r.active_admins)>=1);console.log(JSON.stringify(r));}
  else if(command==="smoke"){const c=await pool.connect();try{await c.query("BEGIN");const stamp=Date.now().toString(36);const {rows:[category]}=await c.query("INSERT INTO dbo.categories(categoryname) VALUES($1) RETURNING categoryid",[`Smoke ${stamp}`]);await c.query("UPDATE dbo.categories SET categoryname=$1,isactive=false WHERE categoryid=$2",[`Smoke updated ${stamp}`,category.categoryid]);await c.query("UPDATE dbo.categories SET isactive=true WHERE categoryid=$1",[category.categoryid]);await assert.rejects(()=>c.query("INSERT INTO dbo.categories(categoryname) VALUES($1)",[`Smoke updated ${stamp}`]));await c.query("ROLLBACK");console.log("Postgres rollback smoke: PASS");}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}}
  else throw new Error("Use schema, seed, integrity, or smoke.");
}finally{await pool.end();}
