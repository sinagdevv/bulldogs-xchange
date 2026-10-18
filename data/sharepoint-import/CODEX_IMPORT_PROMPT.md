# BULLDOGS XCHANGE — IMPORT THE REAL SHAREPOINT CSV CATALOG INTO THE WEBSITE

MODE: INSPECT → RECONCILE → IMPLEMENT → DRY RUN → VERIFY → REPORT

**Deadline: tomorrow.** One Codex session; use Serena/Ponytail if available. The user supplied actual SharePoint CSV exports and wants the real merchandise catalog in Bulldogs Xchange, **not a live SharePoint sync service**. Do not waste time building Microsoft Graph polling or two-way sync. Implement the existing-app CSV import path and working Admin catalog/variant UI with minimal changes.

**Environment:** Repo `C:\Users\John Ray\Desktop\bulldogs-xchange`; approved Supabase `qyzwruvggwxbmqrurmxh`; approved Vercel `prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf`. Protected Supabase `miwodndxgrdyanrloxig`: NEVER ACCESS. Existing Admin dashboard works. Current product/category/variant CRUD backend is reportedly present; screens were read-only during prior QA. Barky Admin FAQ route fix `91ee073` must not regress.

**Input:** Read every file in this package: `manifest.json`, `categories_clean.csv`, `products_clean.csv`, `variants_clean.csv`, `inventory_reviewed.csv`, `inventory_exceptions.csv`, `excluded_test_rows.csv`, `README.md`. They derive from exported `Categories.csv`, `Products.csv`, `Product Variants.csv`, `Inventory.csv`. Clean dataset: 5 categories, 19 products, 79 variants, 75 complete stock rows, 4 incomplete stock rows, 4 excluded test rows. Do not import the test rows. Do not silently fill missing values.

## Task 1 — real catalog integration

1. Inspect the **actual** PostgreSQL schema and repo catalog implementation. Do not assume CSV IDs equal DB primary keys or that frontend preview items and reservable products share a table.
2. Build an idempotent authenticated operator CSV import (CLI or existing Admin API service) with dry-run as the default. Stable external source IDs must map: category → product → variant → inventory; preserve foreign-key relationships. No blind merge on duplicate titles; use SKU + explicit external mapping. Support PHP decimal prices exactly, source featured flags and active/inactive statuses. Normalize Unicode currency and metadata; preserve images already on the website if export ImageURL is blank.
3. Make the website's Admin and customer catalog use imported product/category/variant data through existing services; preserve NU styling and existing preview-versus-reservable behavior. Product variants are actual stock-keeping units, not fake display sizes. Keep backend authorization and audit controls. Restore/finish functional Admin CRUD using existing API contracts, if unfinished.
4. SharePoint products MRC-SHIRT ₱299, MRC-TOTE ₱100, MRC-CAP ₱249 may or may not correspond to existing BX-SHIRT ₱399, BX-TOTE ₱249, BX-CAP ₱349. Never overwrite any existing BX price, stock, order, or SKU, or claim they are identical without verified mapping. Show price conflicts explicitly.
5. Do not infer available inventory from `is_active`, and do not infer live reservations from the `reserved_quantity` CSV column. Current PostgreSQL remains authoritative for inventory, reservation, payment, audit, and queue operations.

## Task 2 — safe inventory handling

`inventory_reviewed.csv` contains **75** fully specified, foreign-key-verified rows and a total exported physical quantity of **1,022**. These are CSV snapshot values, NOT automatically trusted live quantities. Four source inventory records have blank ID, PhysicalQuantity, and ReorderLevel but a reserved quantity of 1 each: `SHS-PANTS-M-M`, `COL-POLO-M-S`, `COL-POLO-M-L`, `COL-POLO-M-XL`. These require explicit review. The excluded test inventory `TEST-VARIANT-001` must never appear.

- Import catalog metadata first. Keep inventory data as REVIEW/PENDING unless a reconciled, separately approved stock baseline exists.
- Compare each inventory row with existing PostgreSQL quantities and active reservations, and show diffs; do not zero or overwrite operational stock. Missing rows must remain unknown rather than out of stock unless runtime stock is already verified.
- Never generate financial transactions, reservations, notification outbox dispatches, or adjustments as a side effect of catalog import.

## Task 3 — validation and release

1. Run dry-run with readable counts: create / update / unchanged / conflict / skipped, alongside exact SKU conflicts. Dry-run has NO writes.
2. Validate category IDs, 19 SKUs, 79 unique VariantSKU values and 75 complete inventory mappings, and report four exception rows. No duplicate inserts on a second run.
3. Run focused tests, role authorization tests, typechecks, builds and DB integration tests in a disposable environment if available. Do not pretend tests on fixtures prove production.
4. Commit verified app/code changes; do not add secrets, source personal data, or AI attribution. Preserve unrelated worktree changes.
5. **Do not apply production catalog writes, migrations, or deployment without separately confirming the dry-run reconciliation and any conflicting live stock/price mappings.** Once approved, apply guarded transactional/import steps to only `qyzwruvggwxbmqrurmxh` and verify exact live readback; deploy only to approved Vercel.

**Final response:** actual schema mapping; implemented files; dry-run create/update/conflict counts; whether 5 categories, 19 products, 79 variants appear in real website; why four inventory rows blocked; tests; commit; deployment status; exact remaining action. Be concise. Do real implementation, not another broad roadmap.
