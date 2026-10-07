SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.InventoryMovements','PreviousReservedQuantity') IS NULL ALTER TABLE dbo.InventoryMovements ADD PreviousReservedQuantity INT NULL;
IF COL_LENGTH('dbo.InventoryMovements','ResultingReservedQuantity') IS NULL ALTER TABLE dbo.InventoryMovements ADD ResultingReservedQuantity INT NULL;

IF OBJECT_ID('dbo.IdempotencyKeys','U') IS NULL
CREATE TABLE dbo.IdempotencyKeys (
  Scope NVARCHAR(100) NOT NULL,
  IdempotencyKey NVARCHAR(200) NOT NULL,
  EntityId NVARCHAR(100) NOT NULL,
  ResultReference NVARCHAR(100) NULL,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_IdempotencyKeys_Created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_IdempotencyKeys PRIMARY KEY(Scope,IdempotencyKey)
);

IF OBJECT_ID('dbo.AutomationOutbox','U') IS NULL
CREATE TABLE dbo.AutomationOutbox (
  AutomationEventId BIGINT IDENTITY PRIMARY KEY,
  EventType NVARCHAR(100) NOT NULL,
  AggregateType NVARCHAR(100) NOT NULL,
  AggregateId NVARCHAR(100) NOT NULL,
  Payload NVARCHAR(MAX) NOT NULL,
  Status NVARCHAR(50) NOT NULL CONSTRAINT DF_AutomationOutbox_Status DEFAULT N'Pending',
  Attempts INT NOT NULL CONSTRAINT DF_AutomationOutbox_Attempts DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AutomationOutbox_Created DEFAULT SYSUTCDATETIME(),
  ProcessedAt DATETIME2 NULL,
  CONSTRAINT CK_AutomationOutbox_PayloadJson CHECK(ISJSON(Payload)=1),
  CONSTRAINT CK_AutomationOutbox_Attempts CHECK(Attempts>=0)
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_Transactions_ReservationId') CREATE UNIQUE INDEX UX_Transactions_ReservationId ON dbo.Transactions(ReservationId);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='UX_QueueEntries_ActiveReservation') CREATE UNIQUE INDEX UX_QueueEntries_ActiveReservation ON dbo.QueueEntries(ReservationId) WHERE CompletedAt IS NULL;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_AutomationOutbox_Status_Created') CREATE INDEX IX_AutomationOutbox_Status_Created ON dbo.AutomationOutbox(Status,CreatedAt);

COMMIT;
