import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;
assert.ok(connectionString, "SUPABASE_DATABASE_URL is required");
const caPath = process.env.SUPABASE_CA_CERT_PATH;
const pool = new pg.Pool({
  connectionString,
  ssl: { ca: caPath ? readFileSync(caPath, "utf8") : undefined, rejectUnauthorized: true },
  max: 1,
});

const query = async (text) => (await pool.query(text)).rows;
try {
  const [connection] = await query("SELECT current_database() database, current_user database_user, current_setting('ssl') ssl, inet_server_addr() IS NOT NULL remote_server");
  const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='dbo' AND table_type='BASE TABLE' ORDER BY table_name");
  const constraints = await query("SELECT constraint_type, count(*)::int count FROM information_schema.table_constraints WHERE table_schema='dbo' AND constraint_type IN ('FOREIGN KEY','UNIQUE') GROUP BY constraint_type ORDER BY constraint_type");
  const references = await query(`SELECT
    (SELECT array_agg(rolename ORDER BY rolename) FROM dbo.roles) roles,
    (SELECT array_agg(statusname ORDER BY statusname) FROM dbo.reservationstatuses) reservation_statuses,
    (SELECT array_agg(queuetypename ORDER BY queuetypename) FROM dbo.queuetypes) queue_types,
    (SELECT array_agg(statusname ORDER BY statusname) FROM dbo.queuestatuses) queue_statuses,
    (SELECT array_agg(paymentmethodname ORDER BY paymentmethodname) FROM dbo.paymentmethods) payment_methods,
    (SELECT array_agg(statusname ORDER BY statusname) FROM dbo.transactionstatuses) transaction_statuses,
    (SELECT array_agg(movementtypename ORDER BY movementtypename) FROM dbo.inventorymovementtypes) movement_types,
    (SELECT jsonb_object_agg(settingkey,settingvalue) FROM dbo.systemsettings) settings`);
  const [integrity] = await query(`SELECT
    (SELECT count(*)::int FROM dbo.users) users,
    (SELECT count(*)::int FROM dbo.users u JOIN dbo.roles r USING(roleid) WHERE u.isactive AND r.rolename='Admin') active_admins,
    (SELECT count(*)::int FROM dbo.users u LEFT JOIN dbo.roles r USING(roleid) WHERE r.roleid IS NULL) invalid_user_roles,
    (SELECT count(*)::int FROM dbo.products p LEFT JOIN dbo.categories c USING(categoryid) WHERE c.categoryid IS NULL) orphan_products,
    (SELECT count(*)::int FROM dbo.productvariants v LEFT JOIN dbo.products p USING(productid) WHERE p.productid IS NULL) orphan_variants,
    (SELECT count(*)::int FROM dbo.inventory i LEFT JOIN dbo.productvariants v USING(productvariantid) WHERE v.productvariantid IS NULL) orphan_inventory,
    (SELECT count(*)::int FROM dbo.productvariants v LEFT JOIN dbo.inventory i USING(productvariantid) WHERE i.productvariantid IS NULL) variants_without_inventory,
    (SELECT count(*)::int FROM dbo.inventory WHERE physicalquantity<0 OR reservedquantity<0) negative_inventory,
    (SELECT count(*)::int FROM dbo.inventory WHERE reservedquantity>physicalquantity) over_reserved_inventory,
    (SELECT count(*)::int FROM (SELECT sku FROM dbo.products GROUP BY sku HAVING count(*)>1) d) duplicate_product_skus,
    (SELECT count(*)::int FROM (SELECT variantsku FROM dbo.productvariants GROUP BY variantsku HAVING count(*)>1) d) duplicate_variant_skus,
    (SELECT count(*)::int FROM dbo.reservations r LEFT JOIN dbo.users u ON u.userid=r.customerid LEFT JOIN dbo.reservationstatuses s USING(reservationstatusid) WHERE u.userid IS NULL OR s.reservationstatusid IS NULL) orphan_reservations,
    (SELECT count(*)::int FROM dbo.reservationitems i LEFT JOIN dbo.reservations r USING(reservationid) LEFT JOIN dbo.productvariants v USING(productvariantid) WHERE r.reservationid IS NULL OR v.productvariantid IS NULL) orphan_reservation_items,
    (SELECT count(*)::int FROM dbo.queueentries q LEFT JOIN dbo.users u ON u.userid=q.customerid LEFT JOIN dbo.reservations r USING(reservationid) LEFT JOIN dbo.queuetypes t USING(queuetypeid) LEFT JOIN dbo.queuestatuses s USING(queuestatusid) WHERE u.userid IS NULL OR r.reservationid IS NULL OR t.queuetypeid IS NULL OR s.queuestatusid IS NULL) orphan_queue_entries,
    (SELECT count(*)::int FROM dbo.transactions t LEFT JOIN dbo.reservations r USING(reservationid) LEFT JOIN dbo.users c ON c.userid=t.customerid LEFT JOIN dbo.users s ON s.userid=t.staffid LEFT JOIN dbo.transactionstatuses ts USING(transactionstatusid) WHERE r.reservationid IS NULL OR c.userid IS NULL OR s.userid IS NULL OR ts.transactionstatusid IS NULL) orphan_transactions,
    (SELECT count(*)::int FROM dbo.automationoutbox WHERE (status='Delivered' AND deliveredat IS NULL) OR (status='DeadLetter' AND attempts<1) OR (status='Superseded' AND supersededat IS NULL) OR (status='Processing' AND lockedat IS NULL)) invalid_outbox,
    (SELECT count(*)::int FROM dbo.automationoutbox) outbox_rows`);

  assert.equal(tables.length, 24);
  for (const key of Object.keys(integrity).filter((key) => !["users", "active_admins", "outbox_rows"].includes(key))) assert.equal(integrity[key], 0, key);
  console.log(JSON.stringify({ connection, tables: tables.map((row) => row.table_name), constraints, references: references[0], integrity }, null, 2));
} finally {
  await pool.end();
}
