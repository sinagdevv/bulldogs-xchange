\if :{?runtime_password}
\else
  \echo 'runtime_password is required'
  \quit 2
\endif

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bulldogs_app_runtime') THEN
    CREATE ROLE bulldogs_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

ALTER ROLE bulldogs_app_runtime LOGIN PASSWORD :'runtime_password';
REVOKE ALL ON SCHEMA public, auth, vault FROM bulldogs_app_runtime;
GRANT CONNECT ON DATABASE postgres TO bulldogs_app_runtime;
GRANT USAGE ON SCHEMA dbo TO bulldogs_app_runtime;

GRANT SELECT ON TABLE
  dbo.roles, dbo.departments, dbo.reservationstatuses, dbo.queuetypes,
  dbo.queuestatuses, dbo.paymentmethods, dbo.transactionstatuses,
  dbo.inventorymovementtypes, dbo.campusclosures, dbo.counteroperatinghours,
  dbo.users, dbo.approvalhistory, dbo.categories, dbo.products,
  dbo.productvariants, dbo.inventory, dbo.reservations, dbo.reservationitems,
  dbo.queueentries, dbo.transactions, dbo.transactionitems,
  dbo.inventorymovements, dbo.notifications, dbo.auditlogs,
  dbo.systemsettings, dbo.idempotencykeys, dbo.automationoutbox,
  dbo.reservationdeposits, dbo.depositrefunds
TO bulldogs_app_runtime;

GRANT INSERT ON TABLE
  dbo.users, dbo.approvalhistory, dbo.categories, dbo.products,
  dbo.productvariants, dbo.inventory, dbo.reservations, dbo.reservationitems,
  dbo.queueentries, dbo.transactions, dbo.transactionitems,
  dbo.inventorymovements, dbo.notifications, dbo.auditlogs,
  dbo.idempotencykeys, dbo.automationoutbox, dbo.reservationdeposits,
  dbo.depositrefunds
TO bulldogs_app_runtime;

GRANT UPDATE ON TABLE
  dbo.users, dbo.categories, dbo.products, dbo.productvariants, dbo.inventory,
  dbo.reservations, dbo.queueentries, dbo.transactions, dbo.notifications,
  dbo.systemsettings, dbo.automationoutbox, dbo.reservationdeposits,
  dbo.depositrefunds
TO bulldogs_app_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dbo TO bulldogs_app_runtime;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA dbo FROM bulldogs_app_runtime;
REVOKE CREATE ON SCHEMA dbo, public FROM bulldogs_app_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA auth, vault FROM bulldogs_app_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth, vault FROM bulldogs_app_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth, vault FROM bulldogs_app_runtime;
