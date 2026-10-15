# SQL identity provisioning

Supabase Auth authenticates people; `dbo.users` authorizes them. Provider roles and user metadata are ignored.

After a new student's verified OTP session, customer onboarding accepts school ID, full name, customer type, and optional department. The trusted token email must end in `@students.nu-fairview.edu.ph`. A transaction rejects any existing email or school ID and inserts exactly one Customer. Returning users are loaded by normalized email, preserving their `userid`, reservations, and history.

Staff/Admin roles require explicit approval through authorized SQL-backed administration. The hosted demo uses student-domain addresses for every persona, including its Staff and Admin demo identities; no employment mailbox or domain-based privilege is required. No application endpoint exposes passwords or provider credentials.

The initial Admin procedure requires a verified Supabase OTP access token whose email matches the requested identity and the exact operator approval phrase. If the matching initial identity is already a Customer, it is elevated in place so its `userid` and history remain unchanged. An existing active Admin blocks another bootstrap.
