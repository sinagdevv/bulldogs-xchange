# Bulldogs Xchange — SharePoint CSV catalog import package

Prepared from the four uploaded SharePoint exports. No application database, repository, or website was modified.

## Exact included rows

- `categories_clean.csv`: **5** active categories, SharePoint external IDs 1–5.
- `products_clean.csv`: **19** active real products, normalized PHP prices and source category IDs.
- `variants_clean.csv`: **79** active variants, mapped by source product IDs.
- `inventory_reviewed.csv`: **75** complete, ID-matched inventory rows. **Review first; do not blindly overwrite production stock.**
- `inventory_exceptions.csv`: **4** inventory records missing their SharePoint variant ID, physical quantity, and reorder level. Each reports reserved quantity = 1. Never treat those as zero, guess values, or apply reservations.
- `excluded_test_rows.csv`: inactive test category, test product, test variant, and test inventory row.
- `manifest.json`: counts, reconciliation guards, source SHA256.

## Source notes

The files are a **static CSV snapshot**, not a live Microsoft Graph/SharePoint connection. All 19 Products.csv `ImageURL` fields are empty; use existing real images when mapped, or explicit placeholders. Duplicate product titles across SHS/College are intentional; resolve by SKU and category, never by title. Both 'Traditional Pants - Female' and 'Traditional Pants - Women' exist as distinct source products. Do not merge them.

Existing production BX-SHIRT (₱399), BX-TOTE (₱249), BX-CAP (₱349) should not be overwritten simply because source contains MRC-SHIRT (₱299), MRC-TOTE (₱100), MRC-CAP (₱249). These are **potential**, not verified, SKU mappings.

## Safe application procedure

1. Inspect the application's actual PostgreSQL schemas/API contracts and inspect approved production catalog **read-only**.
2. Implement dry-run mapping by `sp_category_id`, `sp_product_id`, `sp_variant_id`; preserve PostgreSQL-generated IDs and FK relationships.
3. Show categorized counts (create/update/unchanged/conflict/skip) and full diff. Never hard-code SharePoint IDs as native database IDs.
4. Reconcile pricing, availability, featured flags, image references and inventory ownership with existing preview/reservable products; require approval for destructive or price-altering changes.
5. Import metadata by idempotent guarded transaction after explicit production approval. Do not make stock inventory authoritative without approved physical stock verification.
6. Re-run dry-run to confirm unchanged; test customer/admin catalog rendering and authorization. Keep reservation/transaction/audit/outbox intact.

## Stop conditions

- Any ambiguous SKU mapping, missing image/stock, competing stock ownership, orphaned variant, duplicate external key, user-transaction dependency, or unapproved production write.
- Any use of protected project `miwodndxgrdyanrloxig`.

Approved project: `qyzwruvggwxbmqrurmxh`. No files in this package contain Supabase credentials.
