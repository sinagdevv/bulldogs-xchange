import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import pg from "pg";

const url=process.env.FINANCIAL_STAGING_DATABASE_URL;
if(!url)throw new Error("FINANCIAL_STAGING_DATABASE_URL is required.");
if(process.env.FINANCIAL_STAGING_CONFIRM!=="DISPOSABLE")throw new Error("Set FINANCIAL_STAGING_CONFIRM=DISPOSABLE only for an isolated database.");
const target=new URL(url),expected=process.env.FINANCIAL_STAGING_DATABASE_NAME??"bulldogs_xchange_staging",operational="miwodndxgrdyanrloxig";
if(url===process.env.SUPABASE_DATABASE_URL||target.hostname.includes(operational)||process.env.FINANCIAL_STAGING_PROJECT_REF===operational)throw new Error("Refusing the operational Supabase project.");
if(target.pathname.slice(1)!==expected||!/(staging|test)/i.test(expected))throw new Error("Staging database name is not explicitly isolated.");

const pool=new pg.Pool({connectionString:url,ssl:process.env.FINANCIAL_STAGING_SSL==="true"?{rejectUnauthorized:true}:false,max:1});
const baseline=await readFile(new URL("../database/postgres/001_normalized_schema.sql",import.meta.url),"utf8");
const seed=await readFile(new URL("../database/postgres/002_demo_seed.sql",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261011090000_deposit_expiration.sql",import.meta.url),"utf8");
try{
  const {rows:[identity]}=await pool.query("SELECT current_database() database,current_user username,inet_server_addr() address");
  assert.equal(identity.database,expected,"Connected database identity changed.");
  const {rows:[inventory]}=await pool.query("SELECT count(*)::int tables FROM information_schema.tables WHERE table_schema='dbo'");
  if(inventory.tables===0){await pool.query(baseline);await pool.query(seed);await pool.query("INSERT INTO dbo.systemsettings(settingkey,settingvalue,datatype,description) VALUES('FinancialStagingEnvironment','true','Boolean','Disposable financial validation database') ON CONFLICT(settingkey) DO UPDATE SET settingvalue='true'");}
  const {rows:[marker]}=await pool.query("SELECT settingvalue FROM dbo.systemsettings WHERE settingkey='FinancialStagingEnvironment'");
  assert.equal(marker?.settingvalue,"true","Existing database is not marked as disposable financial staging.");
  const {rows:[before]}=await pool.query("SELECT count(*)::int reservations FROM dbo.reservations");
  await pool.query(migration);
  const {rows:[after]}=await pool.query("SELECT count(*)::int reservations FROM dbo.reservations");
  assert.equal(after.reservations,before.reservations,"Migration changed historical reservations.");
  const {rows:[objects]}=await pool.query(`SELECT
    to_regclass('dbo.reservationdeposits') IS NOT NULL deposits,
    to_regclass('dbo.depositrefunds') IS NOT NULL refunds,
    to_regclass('dbo.campusclosures') IS NOT NULL closures,
    to_regclass('dbo.counteroperatinghours') IS NOT NULL hours,
    (SELECT settingvalue FROM dbo.systemsettings WHERE settingkey='DepositWorkflowEnabled') feature_flag,
    (SELECT count(*)::int FROM dbo.reservationdeposits) deposit_rows,
    (SELECT count(*)::int FROM dbo.depositrefunds) refund_rows`);
  assert.deepEqual(objects,{deposits:true,refunds:true,closures:true,hours:true,feature_flag:"false",deposit_rows:0,refund_rows:0});
  const {rows:indexes}=await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='dbo' AND indexname IN ('uq_reservationdeposits_paymentreference','uq_depositrefunds_refundreference','uq_transactions_receiptreference','ix_depositrefunds_admin_review','ix_depositrefunds_assigned') ORDER BY indexname");
  assert.equal(indexes.length,5,"A required financial index is missing.");
  console.log(JSON.stringify({target:{database:identity.database,user:identity.username,address:identity.address},migration:"PASS",historicalReservations:"UNCHANGED",featureFlag:"false",financialRows:"NONE",requiredIndexes:indexes.length,externalPayments:"NONE",externalNotifications:"NONE"},null,2));
}finally{await pool.end();}
