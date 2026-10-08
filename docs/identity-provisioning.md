# SQL identity provisioning

Auth0 authenticates people; `dbo.users` authorizes them. A token is accepted only when Auth0 supplies a signed `sub`, normalized `email`, and `email_verified=true`. The API then looks up that email in SQL, rejects missing or inactive rows, and uses only `dbo.roles.rolename` for authorization. Auth0 metadata never grants an application role.

Every identity requires an operator-supplied, verified Auth0 email plus `schoolid`, `fullname`, and an existing role reference. `departmentid` and `customertype` are optional. Emails and school IDs are unique.

- Customer: role `Customer`, active account; permitted to use customer workflows.
- Staff: role `Staff`, active account; designation requires operator approval because it enables staff workflows.
- Admin: role `Admin`, active account; designation requires explicit operator approval because it enables administration and role changes.

## Initial Admin bootstrap

The initial Admin is a one-time operator procedure, not an application startup behavior:

1. The operator identifies the intended person and confirms their Auth0 email is verified.
2. The operator supplies the email, school ID, and full name through protected parameters; credentials and tokens are never inputs or output.
3. Before execution, require an explicit approval statement naming the intended email and the Admin role.
4. In one transaction, lock the matching email and school ID, resolve `Admin` from `dbo.roles`, and insert an active row only when neither unique identity exists.
5. If the same email and school ID already identify an active Admin, return success without changing it. Any mismatch, inactive row, different role, missing role, or duplicate identity aborts.

Parameterized PostgreSQL shape (execute only after the approval above):

```sql
BEGIN;
SELECT userid,email,schoolid FROM dbo.users
WHERE lower(email)=lower($1) OR schoolid=$2
FOR UPDATE;
-- Abort unless zero rows, or exactly the already-matching active Admin row.
INSERT INTO dbo.users(schoolid,fullname,email,roleid,isactive)
SELECT $2,$3,lower($1),roleid,true FROM dbo.roles WHERE rolename='Admin'
ON CONFLICT DO NOTHING
RETURNING userid;
COMMIT;
```

The operator must check the selected/returned row count inside the transaction; `ON CONFLICT DO NOTHING` alone is not proof that the existing row is the intended identity. No seed file creates users, and demo `.test` fixture identities are not live identities.

Subsequent Customer and Staff provisioning follows the same parameterized, duplicate-safe process with an explicitly selected SQL role. It must not modify Auth0 accounts or infer roles from provider claims.
