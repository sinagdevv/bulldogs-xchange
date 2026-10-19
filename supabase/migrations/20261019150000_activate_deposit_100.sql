-- Migration: Activate ₱100 reservation deposit workflow
-- Prepared only — DO NOT apply without explicit approval
-- Depends on: 20261011090000_deposit_expiration.sql (must be applied first)
--
-- Run in: Supabase SQL Editor (project qyzwruvggwxbmqrurmxh)
-- Rollback: See bottom of file

-- 1. Set deposit amount to ₱100 (overrides ₱200 from prior migration)
UPDATE dbo."SystemSettings"
   SET "Value" = '100.00',
       "UpdatedAt" = NOW()
 WHERE "Key" = 'ReservationDepositAmount';

-- 2. Ensure Cash payment method exists and is active
INSERT INTO dbo."PaymentMethods" ("Name", "IsActive", "CreatedAt")
VALUES ('Cash', true, NOW())
ON CONFLICT ("Name") DO UPDATE
   SET "IsActive" = true,
       "UpdatedAt" = NOW();

-- 3. Add default CounterOperatingHours Mon–Fri 08:00–17:00 if none exist
INSERT INTO dbo."CounterOperatingHours" ("DayOfWeek", "OpenTime", "CloseTime", "IsOpen", "CreatedAt")
SELECT d.dow, '08:00:00'::time, '17:00:00'::time, true, NOW()
FROM (VALUES (1),(2),(3),(4),(5)) AS d(dow)
WHERE NOT EXISTS (SELECT 1 FROM dbo."CounterOperatingHours");

-- 4. Add Saturday as closed (day 6) if none exist
INSERT INTO dbo."CounterOperatingHours" ("DayOfWeek", "OpenTime", "CloseTime", "IsOpen", "CreatedAt")
SELECT 6, '08:00:00'::time, '12:00:00'::time, false, NOW()
WHERE NOT EXISTS (SELECT 1 FROM dbo."CounterOperatingHours" WHERE "DayOfWeek" = 6);

-- ============================================================
-- ROLLBACK (run only before feature is enabled and tables are empty):
-- UPDATE dbo."SystemSettings" SET "Value" = '200.00' WHERE "Key" = 'ReservationDepositAmount';
-- DELETE FROM dbo."CounterOperatingHours";
-- UPDATE dbo."PaymentMethods" SET "IsActive" = false WHERE "Name" = 'Cash';
-- ============================================================
