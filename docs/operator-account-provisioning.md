# Operator account provisioning

This workflow remains disabled unless `ENABLE_OPERATOR_PROVISIONING=true`. Review and separately authorize the alias-hook migration before enabling it. Supply exactly four operator-approved records in a local JSON file; passwords are operator-provided and are never generated or printed.

Run `npm run auth:provision-accounts -- --operator-provisioning=true --accounts-file=<path> --confirm="PROVISION FOUR PENDING BULLDOGS XCHANGE ACCOUNTS"` for the default dry-run. Add `--dry-run=false` only after the project/database identity and dry-run results are approved. Every identity is created as Customer/pending; use the existing approval and exact-confirmation Admin bootstrap workflows afterward.

Rollback a created entry in reverse order: identify its immutable `AuthSubject` and application `UserId` in a trusted operator session; verify it has no dependent business records; delete the Supabase Auth identity; then transactionally delete its pending approval/audit records and Customer row. Never delete an account with reservations, payments, inventory actions, or role changes. If provider creation succeeds but the database transaction fails, the CLI deletes that new Auth identity automatically. Expired allowlist entries are inert and may be deleted after verification.
