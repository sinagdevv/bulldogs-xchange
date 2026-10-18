-- ============================================================================
-- Bulldogs Xchange — LIVE DEMO PRESENTATION SEED (PREPARED, NOT EXECUTED)
-- ============================================================================
-- Status: DRAFT FOR REVIEW. Nobody has run this against the approved
-- Supabase project (qyzwruvggwxbmqrurmxh) yet. Do not run it until a human
-- operator has:
--   1. Confirmed `current_database()`/project ref match qyzwruvggwxbmqrurmxh
--      (never miwodndxgrdyanrloxig).
--   2. Read the accompanying dry-run / impact report.
--   3. Given explicit written authorization to proceed.
--
-- Revision note (per explicit instruction, overriding this file's original
-- v1 comment): this deployment is a demonstration system, not the school's
-- operational sales system. Synthetic completed sales are INTENTIONALLY
-- written as ordinary dbo.transactions rows and WILL contribute to Total
-- Revenue / Total Sales / Sales Trends / Best-Selling Products / Financial
-- Reports exactly like a real sale would. No isdemo column, no reporting
-- filter, no revenue isolation. That is the explicit, informed choice of
-- the person who owns this deployment, made after the isolation trade-off
-- was explained -- not an oversight.
--
-- Isolation that IS still kept: a dedicated "Demo Presentation Catalog"
-- category/products/variants/inventory, so nothing here touches the real
-- SharePoint catalog, its 79 variants, or its stock. Demo students use the
-- DEMO- SchoolId prefix and .invalid email domain so they can never
-- collide with a real classmate and never receive real mail.
--
-- Idempotent: every INSERT guards on a unique constraint or an explicit
-- existence check. The two inventory UPDATEs are additionally gated by a
-- one-time systemsettings marker (set at the very end of this script) so
-- a second run changes no quantities, even on a slow or retried execution.
-- ============================================================================
BEGIN;

-- ---- 1. Demo department
INSERT INTO dbo.departments(departmentname)
VALUES ('Demo Presentation Cohort (Oct 2026)')
ON CONFLICT (departmentname) DO NOTHING;

-- ---- 2. 15 synthetic students: 9 approved, 3 pending, 2 suspended, 1 rejected
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

-- ---- 3. Approval history
INSERT INTO dbo.approvalhistory(accountuserid, action, actingadminuserid, reason)
SELECT u.userid, u.approvalstatus, NULL, CASE WHEN u.approvalstatus='rejected' THEN u.rejectionreason ELSE 'Demo presentation seed' END
FROM dbo.users u
WHERE u.schoolid LIKE 'DEMO-STU-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.approvalhistory ah WHERE ah.accountuserid = u.userid);

-- ---- 4. Isolated demo catalog (never touches the real SharePoint catalog)
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
  0, 5
FROM dbo.productvariants pv JOIN dbo.products p USING (productid)
WHERE p.sku IN ('DEMO-BX-SHIRT','DEMO-BX-CAP','DEMO-BX-TOTE')
  AND NOT EXISTS (SELECT 1 FROM dbo.inventory i WHERE i.productvariantid = pv.productvariantid);

-- ---- 5. 18 demo reservations: 2 Pending, 2 Confirmed, 2 Preparing,
-- 4 Ready for Pickup, 6 Completed, 2 Cancelled (within the requested range;
-- 6 Completed so there are 6 real completed sales to report in step 7).
INSERT INTO dbo.reservations(reference, customerid, reservationstatusid, expiresat)
SELECT 'BX-DEMO-' || v.n, u.userid, s.reservationstatusid, now() + interval '7 days'
FROM (VALUES
  ('0101','DEMO-STU-01','Pending'),          ('0102','DEMO-STU-02','Pending'),
  ('0103','DEMO-STU-03','Confirmed'),        ('0104','DEMO-STU-04','Confirmed'),
  ('0105','DEMO-STU-05','Preparing'),        ('0106','DEMO-STU-06','Preparing'),
  ('0107','DEMO-STU-07','Ready for Pickup'), ('0108','DEMO-STU-08','Ready for Pickup'),
  ('0109','DEMO-STU-09','Ready for Pickup'), ('0110','DEMO-STU-01','Ready for Pickup'),
  ('0111','DEMO-STU-02','Completed'),        ('0112','DEMO-STU-03','Completed'),
  ('0113','DEMO-STU-04','Completed'),        ('0116','DEMO-STU-07','Completed'),
  ('0117','DEMO-STU-08','Completed'),        ('0118','DEMO-STU-09','Completed'),
  ('0114','DEMO-STU-05','Cancelled'),        ('0115','DEMO-STU-06','Cancelled')
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

-- ---- 6. Reserve movement for every demo reservation (records the hold)
INSERT INTO dbo.inventorymovements(productvariantid, inventorymovementtypeid, previousqty, changeqty, resultingqty, previousreservedquantity, resultingreservedquantity, relatedreference, notes)
SELECT ri.productvariantid, mt.inventorymovementtypeid, i.physicalquantity, 0, i.physicalquantity,
  i.reservedquantity, i.reservedquantity + ri.quantity, r.reference, 'Demo presentation seed: reservation hold.'
FROM dbo.reservations r
JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
JOIN dbo.inventory i ON i.productvariantid = ri.productvariantid
JOIN dbo.inventorymovementtypes mt ON mt.movementtypename = 'Reserve'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.inventorymovements im WHERE im.relatedreference = r.reference AND im.inventorymovementtypeid = mt.inventorymovementtypeid);

-- ---- 7. Completed sales: real dbo.transactions + dbo.transactionitems for
-- the 6 Completed reservations, plus the Sale movement that converts each
-- hold into an actual stock decrement. staffid is resolved dynamically to
-- an existing active Staff account (falls back to Admin if none), never a
-- hardcoded id. totalamount is computed from the reservation's own items,
-- never a separately invented figure, so dashboard/report totals always
-- agree with the underlying rows.
INSERT INTO dbo.transactions(reference, reservationid, customerid, staffid, paymentmethodid, transactionstatusid, totalamount, createdat)
SELECT 'BX-DEMO-TXN-' || right(r.reference,4), r.reservationid, r.customerid,
  (SELECT u.userid FROM dbo.users u JOIN dbo.roles rl ON rl.roleid=u.roleid WHERE u.isactive AND rl.rolename IN ('Staff','Admin') ORDER BY (rl.rolename='Staff') DESC, u.userid ASC LIMIT 1),
  (SELECT paymentmethodid FROM dbo.paymentmethods WHERE paymentmethodname='Other'),
  ts.transactionstatusid,
  (SELECT COALESCE(SUM(ri.quantity * ri.unitprice),0) FROM dbo.reservationitems ri WHERE ri.reservationid = r.reservationid),
  now() - (18 - right(r.reference,2)::int) * interval '12 hours'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Completed'
JOIN dbo.transactionstatuses ts ON ts.statusname = 'Completed'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND EXISTS (SELECT 1 FROM dbo.users u2 JOIN dbo.roles rl2 ON rl2.roleid=u2.roleid WHERE u2.isactive AND rl2.rolename IN ('Staff','Admin'))
  AND NOT EXISTS (SELECT 1 FROM dbo.transactions t WHERE t.reservationid = r.reservationid);

INSERT INTO dbo.transactionitems(transactionid, productvariantid, quantity, unitprice)
SELECT t.transactionid, ri.productvariantid, ri.quantity, ri.unitprice
FROM dbo.transactions t
JOIN dbo.reservations r ON r.reservationid = t.reservationid
JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
WHERE t.reference LIKE 'BX-DEMO-TXN-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.transactionitems ti WHERE ti.transactionid = t.transactionid);

-- ---- 8. Queue entries for the 4 Ready-for-Pickup reservations
INSERT INTO dbo.queueentries(queuenumber, customerid, reservationid, queuetypeid, queuestatusid, joinedat)
SELECT 'DEMO-Q-' || row_number() OVER (ORDER BY r.reference), r.customerid, r.reservationid, qt.queuetypeid, qs.queuestatusid, now() - interval '1 hour'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Ready for Pickup'
JOIN dbo.queuetypes qt ON qt.queuetypename = 'Regular'
JOIN dbo.queuestatuses qs ON qs.statusname = 'Waiting'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.queueentries qe WHERE qe.reservationid = r.reservationid);

-- ---- 9. Completed-queue entries for the 6 Completed reservations (so
-- pickup history/queue reports are consistent with the transaction set)
INSERT INTO dbo.queueentries(queuenumber, customerid, reservationid, queuetypeid, queuestatusid, joinedat, calledat, completedat)
SELECT 'DEMO-Q-' || (10 + row_number() OVER (ORDER BY r.reference)), r.customerid, r.reservationid, qt.queuetypeid, qs.queuestatusid,
  now() - interval '1 day', now() - interval '23 hours', now() - interval '22 hours'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Completed'
JOIN dbo.queuetypes qt ON qt.queuetypename = 'Regular'
JOIN dbo.queuestatuses qs ON qs.statusname = 'Completed'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.queueentries qe WHERE qe.reservationid = r.reservationid);

-- ---- 10. One-time inventory settlement: Sale movement + stock decrement
-- for Completed reservations, Release movement + hold release (no physical
-- change) for Cancelled ones. Gated on a systemsettings marker (inserted
-- at the end of this script) so this NEVER runs twice.
INSERT INTO dbo.inventorymovements(productvariantid, inventorymovementtypeid, previousqty, changeqty, resultingqty, previousreservedquantity, resultingreservedquantity, relatedreference, notes)
SELECT ri.productvariantid, mt.inventorymovementtypeid, i.physicalquantity, -ri.quantity, i.physicalquantity - ri.quantity,
  i.reservedquantity, i.reservedquantity - ri.quantity, r.reference, 'Demo presentation seed: completed sale.'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Completed'
JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
JOIN dbo.inventory i ON i.productvariantid = ri.productvariantid
JOIN dbo.inventorymovementtypes mt ON mt.movementtypename = 'Sale'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.systemsettings WHERE settingkey = 'DemoPresentationSeedApplied')
  AND NOT EXISTS (SELECT 1 FROM dbo.inventorymovements im WHERE im.relatedreference = r.reference AND im.inventorymovementtypeid = mt.inventorymovementtypeid);

INSERT INTO dbo.inventorymovements(productvariantid, inventorymovementtypeid, previousqty, changeqty, resultingqty, previousreservedquantity, resultingreservedquantity, relatedreference, notes)
SELECT ri.productvariantid, mt.inventorymovementtypeid, i.physicalquantity, 0, i.physicalquantity,
  i.reservedquantity, i.reservedquantity - ri.quantity, r.reference, 'Demo presentation seed: cancelled, hold released.'
FROM dbo.reservations r
JOIN dbo.reservationstatuses rs ON rs.reservationstatusid = r.reservationstatusid AND rs.statusname = 'Cancelled'
JOIN dbo.reservationitems ri ON ri.reservationid = r.reservationid
JOIN dbo.inventory i ON i.productvariantid = ri.productvariantid
JOIN dbo.inventorymovementtypes mt ON mt.movementtypename = 'Release'
WHERE r.reference LIKE 'BX-DEMO-%'
  AND NOT EXISTS (SELECT 1 FROM dbo.systemsettings WHERE settingkey = 'DemoPresentationSeedApplied')
  AND NOT EXISTS (SELECT 1 FROM dbo.inventorymovements im WHERE im.relatedreference = r.reference AND im.inventorymovementtypeid = mt.inventorymovementtypeid);

UPDATE dbo.inventory i SET
  physicalquantity = physicalquantity - COALESCE(sale.qty,0),
  reservedquantity = reservedquantity - COALESCE(sale.qty,0) - COALESCE(cancel.qty,0),
  updatedat = now()
FROM (SELECT ri.productvariantid, SUM(ri.quantity) qty FROM dbo.reservations r JOIN dbo.reservationstatuses rs ON rs.reservationstatusid=r.reservationstatusid AND rs.statusname='Completed' JOIN dbo.reservationitems ri ON ri.reservationid=r.reservationid WHERE r.reference LIKE 'BX-DEMO-%' GROUP BY ri.productvariantid) sale
FULL OUTER JOIN (SELECT ri.productvariantid, SUM(ri.quantity) qty FROM dbo.reservations r JOIN dbo.reservationstatuses rs ON rs.reservationstatusid=r.reservationstatusid AND rs.statusname='Cancelled' JOIN dbo.reservationitems ri ON ri.reservationid=r.reservationid WHERE r.reference LIKE 'BX-DEMO-%' GROUP BY ri.productvariantid) cancel
  ON cancel.productvariantid = sale.productvariantid
WHERE i.productvariantid = COALESCE(sale.productvariantid, cancel.productvariantid)
  AND NOT EXISTS (SELECT 1 FROM dbo.systemsettings WHERE settingkey = 'DemoPresentationSeedApplied');

-- ---- 11. Run-once marker: blocks step 10 forever after the first run.
INSERT INTO dbo.systemsettings(settingkey, settingvalue, datatype, description)
VALUES ('DemoPresentationSeedApplied', 'true', 'Boolean', 'Marks that the 2026-10 demo presentation seed''s one-time inventory settlement (Sale/Release movements, stock decrement) has run. Prevents double-application on re-run.')
ON CONFLICT (settingkey) DO NOTHING;

-- ---- 12. Audit trail for the seed itself
INSERT INTO dbo.auditlogs(userid, action, entity, entityid, details)
SELECT NULL, 'DemoPresentationSeed', 'System', 'demo-seed-2026-10', jsonb_build_object('students',15,'reservations',18,'completedTransactions',6,'queueEntries',10,'note','Synthetic completed sales intentionally contribute to normal revenue/reporting totals per explicit instruction.')
WHERE NOT EXISTS (SELECT 1 FROM dbo.auditlogs WHERE entityid = 'demo-seed-2026-10');

COMMIT;
