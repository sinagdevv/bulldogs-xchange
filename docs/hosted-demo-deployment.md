# Hosted demo deployment handoff

Run from authenticated Windows PowerShell, outside the restricted Codex shell. Do not run from the root project's linked Supabase/Vercel context.

```powershell
Set-Location 'C:\Users\John Ray\Desktop\bulldogs-xchange'
.\scripts\hosted-demo-deploy.ps1 -SupabaseProjectRef 'qyzwruvggwxbmqrurmxh' -VercelProjectId 'prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf' -VercelTeam 'johnraycacananta-4646s-projects'
```

Enter secrets through `Read-Host -AsSecureString` or the provider's interactive secret prompt. Never put passwords, service keys, or database URLs in command history, tracked files, or logs. Use a migration credential only for migrations and a separate least-privilege runtime credential for Vercel.

The verifier checks the Supabase JSON inventory for the exact `bulldogs-xchange-demo` / `qyzwruvggwxbmqrurmxh` pair. It checks Vercel's JSON project inventory under the exact team slug `johnraycacananta-4646s-projects` for project `bulldogs-xchange-live-demo` / `prj_pv3TMS6MXH4G58DVvQ8eFpgKuyMf`, and separately accepts the human owner display only as `johnraycacananta-4646's projects`. A team slug and its owner display are not interchangeable.

This command performs read-only identity verification only; it does not deploy. Before any later mutation, keep `POWER_AUTOMATE_DISPATCH_ENABLED=false`, apply only reviewed migrations, seed only synthetic data, and keep public signup disabled.

Provision exactly these four approved demo identities through Supabase Auth invitation/password setup. Require verified inbox ownership, account-holder consent, and successful login before server-side role assignment. All four are NU Fairview student accounts; no Teacher or Staff `@nu-fairview.edu.ph` mailbox is required. Roles remain database-authoritative and are never inferred from the email domain:

| Persona | Email | Database role | Redirect |
|---|---|---|---|
| Admin | `cacanantajrp@students.nu-fairview.edu.ph` | `Admin` | `/admin` |
| Staff | `adalimiu@students.nu-fairview.edu.ph` | `Staff` | `/staff` |
| Student / Customer | `naelgaskwb@students.nu-fairview.edu.ph` | `Customer` | `/home` |
| Teacher demo persona | `cachaperoemc@students.nu-fairview.edu.ph` | `Customer` | `/home` |

Deploy the repository's real `api/` functions and frontend; do not deploy `deployment/static-preview`. Verify `/api/health`, JWT/RBAC, reservation persistence in a second browser, staff pickup, admin reporting, deep links, and zero Power Automate requests. Stop on quota, billing, identity, permission, or target mismatch.
