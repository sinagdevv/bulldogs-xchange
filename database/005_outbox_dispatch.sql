SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.AutomationOutbox','EventId') IS NULL ALTER TABLE dbo.AutomationOutbox ADD EventId UNIQUEIDENTIFIER NULL;
EXEC(N'UPDATE dbo.AutomationOutbox SET EventId=NEWID() WHERE EventId IS NULL');
EXEC(N'ALTER TABLE dbo.AutomationOutbox ALTER COLUMN EventId UNIQUEIDENTIFIER NOT NULL');
IF OBJECT_ID('dbo.DF_AutomationOutbox_EventId','D') IS NULL EXEC(N'ALTER TABLE dbo.AutomationOutbox ADD CONSTRAINT DF_AutomationOutbox_EventId DEFAULT NEWID() FOR EventId');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_AutomationOutbox_EventId') EXEC(N'CREATE UNIQUE INDEX UX_AutomationOutbox_EventId ON dbo.AutomationOutbox(EventId)');

IF COL_LENGTH('dbo.AutomationOutbox','NextAttemptAt') IS NULL ALTER TABLE dbo.AutomationOutbox ADD NextAttemptAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AutomationOutbox','LockedAt') IS NULL ALTER TABLE dbo.AutomationOutbox ADD LockedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AutomationOutbox','DeliveredAt') IS NULL ALTER TABLE dbo.AutomationOutbox ADD DeliveredAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AutomationOutbox','LastError') IS NULL ALTER TABLE dbo.AutomationOutbox ADD LastError NVARCHAR(500) NULL;

EXEC(N'UPDATE dbo.AutomationOutbox SET NextAttemptAt=CreatedAt WHERE NextAttemptAt IS NULL AND Status=N''Pending''');
EXEC(N'UPDATE dbo.AutomationOutbox SET DeliveredAt=COALESCE(ProcessedAt,CreatedAt) WHERE Status=N''Processed''');
UPDATE dbo.AutomationOutbox SET Status=N'Delivered' WHERE Status=N'Processed';

IF EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AutomationOutbox_Status_Created') DROP INDEX IX_AutomationOutbox_Status_Created ON dbo.AutomationOutbox;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AutomationOutbox_Status_NextAttempt') EXEC(N'CREATE INDEX IX_AutomationOutbox_Status_NextAttempt ON dbo.AutomationOutbox(Status,NextAttemptAt,CreatedAt) INCLUDE(EventId,EventType,Attempts,LockedAt)');

MERGE dbo.QueueStatuses AS target
USING (VALUES(N'Left')) AS source(StatusName)
ON target.StatusName=source.StatusName
WHEN NOT MATCHED THEN INSERT(StatusName) VALUES(source.StatusName);

COMMIT;
