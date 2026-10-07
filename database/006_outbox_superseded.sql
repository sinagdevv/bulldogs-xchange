SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.AutomationOutbox','SupersededAt') IS NULL ALTER TABLE dbo.AutomationOutbox ADD SupersededAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AutomationOutbox','SupersededReason') IS NULL ALTER TABLE dbo.AutomationOutbox ADD SupersededReason NVARCHAR(500) NULL;

COMMIT;
