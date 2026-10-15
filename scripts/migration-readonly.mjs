import {readFileSync} from "node:fs";
import pg from "pg";

if(!process.env.SUPABASE_DATABASE_URL)throw new Error("SUPABASE_DATABASE_URL is required");
const ca=process.env.SUPABASE_CA_CERT_PATH;
const pool=new pg.Pool({connectionString:process.env.SUPABASE_DATABASE_URL,ssl:{ca:ca?readFileSync(ca,"utf8"):undefined,rejectUnauthorized:true},max:1});
try{
  const objects=await pool.query(`SELECT 'constraint' kind,conname name,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conname='ck_users_schoolemail_institutional_domain' UNION ALL SELECT 'index',indexname,indexdef FROM pg_indexes WHERE schemaname='dbo' AND indexname='uq_users_institutional_email_normalized'`);
  const migrations=await pool.query(`SELECT version,statements FROM supabase_migrations.schema_migrations WHERE version IN ('20261010090000','20261011090000') ORDER BY version`);
  console.log(JSON.stringify({objects:objects.rows,migrations:migrations.rows.map(row=>({version:row.version,statementCount:Array.isArray(row.statements)?row.statements.length:null}))},null,2));
}finally{await pool.end()}
