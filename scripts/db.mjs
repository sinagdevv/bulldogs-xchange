import fs from "node:fs";
import process from "node:process";
import sql from "mssql";

if (fs.existsSync(".env.local")) for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2]; }
const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"];
if (required.some((key) => !process.env[key])) throw new Error(`Missing SQL configuration: ${required.filter((key) => !process.env[key]).join(", ")}`);
const config = { server: process.env.SQL_SERVER, port: Number(process.env.SQL_PORT ?? 1433), database: process.env.SQL_DATABASE, user: process.env.SQL_USER, password: process.env.SQL_PASSWORD, options: { encrypt: process.env.SQL_ENCRYPT === "true", trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true" }, pool: { min: 0, max: 10, idleTimeoutMillis: 30000 } };
const command = process.argv[2];
const files = { schema: "database/001_schema.sql", reference: "database/002_seed_reference_data.sql", demo: "database/003_seed_demo_data.sql" };
const pool = await sql.connect(config);
try {
  if (command === "check") { const result = await pool.request().query("SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50)) AS version, DB_NAME() AS databaseName, 1 AS connected"); console.log(JSON.stringify(result.recordset[0])); }
  else if (command in files) { const batches = fs.readFileSync(files[command], "utf8").split(/^\s*GO\s*$/gim).filter((batch) => batch.trim()); for (const batch of batches) await pool.request().batch(batch); console.log(`${command} complete`); }
  else if (command === "verify") { const result = await pool.request().query(`SELECT (SELECT COUNT(*) FROM sys.tables WHERE schema_id=SCHEMA_ID('dbo')) AS tables, (SELECT COUNT(*) FROM sys.foreign_keys) AS foreignKeys, (SELECT COUNT(*) FROM sys.check_constraints) AS checkConstraints, (SELECT COUNT(*) FROM dbo.Roles) AS roles, (SELECT COUNT(*) FROM dbo.ReservationStatuses) AS reservationStatuses, (SELECT COUNT(*) FROM dbo.QueueTypes) AS queueTypes, (SELECT COUNT(*) FROM dbo.QueueStatuses) AS queueStatuses, (SELECT COUNT(*) FROM dbo.SystemSettings) AS settings, (SELECT TOP 1 PhysicalQuantity-ReservedQuantity FROM dbo.Inventory ORDER BY ProductVariantId) AS availableQuantity`); const row = result.recordset[0]; if (row.tables < 20 || row.foreignKeys < 20 || row.checkConstraints < 8 || row.roles !== 3 || row.reservationStatuses !== 7 || row.queueTypes !== 2 || row.queueStatuses !== 4 || row.settings < 3) throw new Error("Database verification failed"); console.log(JSON.stringify(row)); }
  else if (command === "smoke") { const result = await pool.request().query("SELECT (SELECT COUNT(*) FROM dbo.Categories) categories,(SELECT COUNT(*) FROM dbo.Products) products,(SELECT COUNT(*) FROM dbo.ProductVariants) variants,(SELECT COUNT(*) FROM dbo.Inventory) inventory,(SELECT COUNT(*) FROM dbo.SystemSettings) settings"); console.log(JSON.stringify(result.recordset[0])); }
  else throw new Error("Unknown database command");
} finally { await pool.close(); }
