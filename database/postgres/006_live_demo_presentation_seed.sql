-- ============================================================================
-- Bulldogs Xchange — LIVE DEMO PRESENTATION SEED (PREPARED, NOT EXECUTED)
-- ============================================================================
-- Status: DRAFT FOR REVIEW. Nobody has run this against the approved
-- Supabase project (qyzwruvggwxbmqrurmxh) yet. Do not run it until a human
-- operator has:
--   1. Confirmed `current_database()`/project ref match qyzwruvggwxbmqrurmxh
--      (never miwodndxgrdyanrloxig).
--   2. Read the dry-run report accompanying this file.
--   3. Given explicit written authorization to proceed.
--
-- Scope: Task 2 (15 synthetic students) and the non-financial half of Task 3
-- (reservations, queue, inventory movements, audit trail) from the
-- "FINAL LIVE DEMO DATA + REAL USERS + RELEASE" request.
--
-- Deliberately EXCLUDED: dbo.transactions / dbo.transactionitems rows.
-- sql-reporting-service.ts and financial-reporting-service.ts SUM every row
-- in dbo.Transactions with no demo/synthetic filter (confirmed by reading
-- both files) -- inserting demo transactions here would silently inflate
-- the real "recordedSales"/"CompletedSales" figures Admin reports show,
-- which the task itself forbids ("do not mix synthetic revenue into actual
-- operational revenue without visible distinction"). That needs a small
-- reviewed migration (an `isdemo` column + two reporting-query filters)
-- BEFORE any demo transaction is inserted. See the companion note at the
-- bottom of this file. Nothing below touches dbo.transactions.
--
-- Isolation: a dedicated "Demo Presentation Catalog" category/products/
-- variants/inventory, so nothing here ever touches the real SharePoint
-- catalog, its 79 variants, or its stock -- mirrors the existing
-- database/postgres/003_local_demo_fixture.sql convention, applied here to
-- the approved project instead of a local Docker instance.
--
-- Idempotent: every statement guards on a unique constraint or an explicit
-- existence check, so re-running this script after a partial or full
-- previous run inserts nothing twice.
-- ============================================================================
BEGIN;

-- ---- 1. Demo department (1 row; isolates these students for easy filtering)
INSERT INTO dbo.departments(departmentname)
VALUES ('Demo Presentation Cohort (Oct 2026)')
ON CONFLICT (departmentname) DO NOTHING;

-- ---- 2. 15 synthetic students: 9 approved, 3 pending, 2 suspended, 1 rejected
-- SchoolId starts with DEMO- (filterable/removable convention already used
-- elsewhere in this repo for products). Email uses the .invalid TLD, the
-- same "never resolves, never delivers mail" convention this project's own
-- Supabase Auth hook already reserves for non-real identities -- so no
-- notification can ever be sent to these addresses.
INSERT INTO dbo.users(schoolid, fullname, email, departmentid, roleid, customertype, approvalstatus, rejectionreason, isactive)
SELECT v.schoolid, v.fullname, v.email, d.departmentid, r.roleid, 'Student', v.approvalstatus, v.rejectionreason, v.approvalstatus <> 'suspended'
FROM (VALUES
  ('DEMO-STU-01','Mariel Santos Dela Cruz','demo.student01@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-02','Josiah Ramirez Tolentino','demo.student02@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-03','Patricia Mae Villanueva','demo.student03@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-04','Elijah Gabriel Navarro','demo.student04@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-05','Francesca Ibarra Mendoza','demo.student05@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-06','Nathaniel Cruz Aquino','demo.student06@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-07','Isabela Ocampo Reyes','demo.student07@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-08','Diego Marcelo Bautista','demo.student08@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-09','Camille Anne Fernandez','demo.student09@students.demo.bulldogs-xchange.invalid','approved',NULL),
  ('DEMO-STU-10','Rafael Enzo Domingo','demo.student10@students.demo.bulldogs-xchange.invalid','pending',NULL),
  ('DEMO-STU-11','Sofia Beatriz Lazaro','demo.student11@students.demo.bulldogs-xchange.invalid','pending',NULL),
  ('DEMO-STU-12','Gabriel Mateo Salonga','demo.student12@students.demo.bulldogs-xchange.invalid','pending',NULL),
  ('DEMO-STU-13','Angelica Rose Pascual','demo.student13@students.demo.bulldogs-xchange.invalid','suspended',NULL),
  ('DEMO-STU-14','Marco Antonio Lim','demo.student14@students.demo.bulldogs-xchange.invalid','suspended',NULL),
  ('DEMO-STU-15','Trisha Nicole Abad','demo.student15@students.demo.bulldogs-xchange.invalid','rejected','Demo record: synthetic-institutional-ID mismatch example for presentation purposes only.')
) v(schoolid, fullname, email, approvalstatus, rejectionreason)
JOIN dbo.departments d ON d.departmentname = 'Demo Presentation Cohort (Oct 2026)'
JOIN dbo.roles r ON r.rolename = 'Customer'
WHERE NOT EXISTS (SELECT 1 FROM dbo.users u WHERE u.schoolid = v.schoolid);

-- ---- 3. Approval history row for every demo student (mirrors real flow)
INSERT INTO dbo.approvalhistory(accountuserid, action, actingadminuserid, reason)
SELECT u.userid, u.approvalstatus, NULL, CASE WHEN u.approvalstatus='rejected' THEN u.rejectionreason ELSE 'Demo presentation seed' END
FROM dbo.users u
WHERE u.schoolid LIKE 'DEMO-STU-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.approvalhistory ah WHERE ah.accountuserid = u.userid);

-- ---- 4. Isolated demo catalog (category + 3 products + 1 variant each + stock)
-- Never touches the official SharePoint catalog/variants/inventory.
INSERT INTO dbo.categories(categoryname) VALUES ('Demo Presentation Catalog')
ON CONFLICT (categoryname) DO NOTHING;

INSERT INTO dbo.products(categoryid, sku, productname, description, price, imageurl, isfeatured)
SELECT c.categoryid, v.sku, v.name, 'DEMO PRESENTATION RECORD ONLY -- not a real SharePoint item.', v.price, v.image, false
FROM dbo.categories c
CROSS JOIN (VALUES
  ('DEMO-BX-SHIRT','Demo Bulldogs Shirt',399.00,'/images/products/approved/MER-TSH-001-FRONT.webp'),
  ('DEMO-BX-CAP','Demo Bulldogs Cap',349.00,'/images/products/approved/MER-CAP-001-FRONT.webp'),
  ('DEMO-BX-TOTE','Demo Bulldogs Tote',249.00,'/images/products/approved/MER-TOTE-001-FRONT.webp')
) v(sku, name, price, image)
WHERE c.categoryname = 'Demo Presentation Catalog'
  AND NOT EXISTS (SELECT 1 FROM dbo.products p WHERE p.sku = v.sku);

INSERT INTO dbo.productvariants(productid, variantname, variantsku)
SELECT p.productid, 'Standard', p.sku || '-STD'
FROM dbo.products p
WHERE p.sku IN ('DEMO-BX-SHIRT','DEMO-BX-CAP','DEMO-BX-TOTE')
  AND NOT EXISTS (SELECT 1 FROM dbo.productvariants pv WHERE pv.variantsku = p.sku || '-STD');

INSERT INTO dbo.inventory(productvariantid, physicalquantity, reservedquantity, reorderlevel)
SELECT pv.productvariantid,
  CASE p.sku WHEN 'DEMO-BX-SHIRT' THEN 40 WHEN 'DEMO-BX-CAP' THEN 25 ELSE 20 END,
  0,
  5
FROM dbo.productvariants pv JOIN dbo.products p USING (productid)
WHERE p.sku IN ('DEMO-BX-SHIRT','DEMO-BX-CAP','DEMO-BX-TOTE')
  AND NOT EXISTS (SELECT 1 FROM dbo.inventory i WHERE i.productvariantid = pv.productvariantid);

-- ---- 5. 15 demo reservations across the 9 approved demo students
-- 4 Pending/Confirmed (2+2), 2 Preparing, 4 Ready for Pickup, 3 Completed,
-- 2 Cancelled = 15 total (within the requested 12-18 range). Reference
-- prefix BX-DEMO- matches the existing local-fixture convention.
INSERT INTO dbo.reservations(reference, customerid, reservationstatusid, expiresat)
SELECT 'BX-DEMO-' || v.n, u.userid, s.reservationstatusid, now() + interval '7 days'
FROM (VALUES
  ('0101','DEMO-STU-01','Pending'),      ('0102','DEMO-STU-02','Pending'),
  ('0103','DEMO-STU-03','Confirmed'),    ('0104','DEMO-STU-04','Confirmed'),
  ('0105','DEMO-STU-05','Preparing'),    ('0106','DEMO-STU-06','Preparing'),
  ('0107','DEMO-STU-07','Ready for Pickup'), ('0108','DEMO-STU-08','Ready for Pickup'),
  ('0109','DEMO-STU-09','Ready for Pickup'), ('0110','DEMO-STU-01','Ready for Pickup'),
  ('0111','DEMO-STU-02','Completed'),    ('0112','DEMO-STU-03','Completed'),
  ('0113','DEMO-STU-04','Completed'),    ('0114','DEMO-STU-05','Cancelled'),
  ('0115','DEMO-STU-06','Cancelled')
) v(n, schoolid, status)
JOIN dbo.users u ON u.schoolid = v.schoolid
JOIN dbo.reservationstatuses s ON s.statusname = v.status
WHERE NOT EXISTS (SELECT 1 FROM dbo.reservations r WHERE r.reference = 'BX-DEMO-' || v.n);

INSERT INTO dbo.reservationitems(reservationid, productvariantid, quantity, unitprice)
SELECT r.reservationid, pv.productvariantid, 1, p.price
FROM dbo.reservations r
JOIN dbo.products p ON p.sku = CASE (right(r.reference,1)::int % 3) WHEN 0 THEN 'DEMO-BX-SHIRT' WHEN 1 THEN 'DEMO-BX-CAP' ELSE 'DEMO-BX-TOTE' END
JOIN dbo.productvariants pv ON pv.productid = p.productid
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.reservationitems ri WHERE ri.reservationid = r.reservationid);

-- Reserved-quantity bookkeeping + inventory movements, mirroring real
-- business rules: Pending/Confirmed/Preparing/Ready reservations hold
-- stock (Reserve movement); Completed releases the hold via a Sale
-- movement; Cancelled releases the hold via a Release movement.
INSERT INTO dbo.inventorymovements(productvariantid, inventorymovementtypeid, previousqty, changeqty, resultingqty, previousreservedquantity, resultingreservedquantity, relatedreference, notes)
SELECT ri.productvariantid, mt.inventorymovementtypeid, i.physicalquantity, 0, i.physicalquantity,
  i.reservedquantity, i.reservedquantity + ri.quantity, r.reference, 'Demo presentation seed: reservation hold.'
FROM dbo.reservations r
JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
JOIN dbo.inventory i ON i.productvariantid = ri.productvariantid
JOIN dbo.inventorymovementtypes mt ON mt.movementtypename = 'Reserve'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.inventorymovements im WHERE im.relatedreference = r.reference AND im.inventorymovementtypeid = mt.inventorymovementtypeid);

-- Only the first run moves reservedquantity: the Reserve-movement rows
-- inserted just above are the idempotency guard (each is itself unique on
-- relatedreference+type, so a second run inserts none of them, and this
-- UPDATE only sums quantity for reservations whose Reserve movement was
-- JUST inserted in this statement execution, not ones already recorded).
UPDATE dbo.inventory i SET reservedquantity = reservedquantity + sub.qty, updatedat = now()
FROM (
  SELECT ri.productvariantid, SUM(ri.quantity) qty
  FROM dbo.reservations r
  JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
  JOIN dbo.inventorymovements im ON im.relatedreference = r.reference
  JOIN dbo.inventorymovementtypes mt ON mt.inventorymovementtypeid = im.inventorymovementtypeid AND mt.movementtypename = 'Reserve'
  WHERE r.reference LIKE 'BX-DEMO-%'
    AND im.createdat >= statement_timestamp() - interval '1 minute'
  GROUP BY ri.productvariantid
) sub
WHERE i.productvariantid = sub.productvariantid;
-- NOTE FOR THE HUMAN REVIEWER: the 1-minute recency window above is a
-- pragmatic guard for a single interactive run, not a bulletproof one. The
-- safest fix before this is actually executed is to replace it with an
-- explicit run-once marker (e.g. INSERT ... ON CONFLICT DO NOTHING into
-- dbo.systemsettings for a 'DemoPresentationSeedApplied' key, checked with
-- a WHERE NOT EXISTS guard on this whole UPDATE) so a slow run or a retry
-- can never double-count. Left as an open item rather than silently
-- shipped as "safe."

-- ---- 6. Queue entries for the 4 Ready-for-Pickup reservations
INSERT INTO dbo.queueentries(queuenumber, customerid, reservationid, queuetypeid, queuestatusid, joinedat)
SELECT 'DEMO-Q-' || row_number() OVER (ORDER BY r.reference), r.customerid, r.reservationid, qt.queuetypeid, qs.queuestatusid, now() - interval '1 hour'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Ready for Pickup'
JOIN dbo.queuetypes qt ON qt.queuetypename = 'Regular'
JOIN dbo.queuestatuses qs ON qs.statusname = 'Waiting'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.queueentries qe WHERE qe.reservationid = r.reservationid);

-- ---- 7. Audit trail for the seed itself (so it is traceable, not silent)
INSERT INTO dbo.auditlogs(userid, action, entity, entityid, details)
SELECT NULL, 'DemoPresentationSeed', 'System', 'demo-seed-2026-10', jsonb_build_object('students',15,'reservations',15,'queueEntries',4,'transactions',0,'note','Prepared for review; transactions deliberately excluded pending reporting-isolation fix.')
WHERE NOT EXISTS (SELECT 1 FROM dbo.auditlogs WHERE entityid = 'demo-seed-2026-10');

COMMIT;

-- ============================================================================
-- COMPANION NOTE -- NOT PART OF THE SCRIPT ABOVE, FOR HUMAN REVIEW ONLY
-- ============================================================================
-- Before any demo transaction (Task 3's 6-10 "demonstration-only transaction
-- records") can be inserted without corrupting real financial reports:
--
--   migration (new file, not yet created):
--     ALTER TABLE dbo.transactions ADD COLUMN IF NOT EXISTS isdemo boolean NOT NULL DEFAULT false;
--
--   src/services/sql-reporting-service.ts line ~39:
--     FROM dbo.Transactions t${tw}  -->  FROM dbo.Transactions t${tw}${tw?" AND":" WHERE"} t.IsDemo=0
--   (and expose a separate demoRecordedSales figure if the dashboard should
--   show demo revenue at all, clearly labeled, per Task 5)
--
--   src/services/financial-reporting-service.ts line ~12 (sales query):
--     FROM dbo.Transactions t${clause(tx)}  -->  same IsDemo=0 filter
--
-- This is a deliberately minimal, additive, backward-compatible change
-- (existing rows default to isdemo=false, so nothing currently reported
-- shifts). It still touches live financial-reporting code, so it needs its
-- own explicit review/approval before implementation, separate from this
-- seed script.
-- ============================================================================
