-- Rate limit counters for authentication endpoints.
-- Stores fixed-length HMAC-SHA256-hashed keys only; no PII is persisted here.
CREATE TABLE IF NOT EXISTS dbo.auth_rate_limits (
  key        varchar(64)  NOT NULL,
  count      integer      NOT NULL DEFAULT 1 CHECK (count >= 1),
  expires_at timestamptz  NOT NULL,
  CONSTRAINT pk_auth_rate_limits PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_expires_at
  ON dbo.auth_rate_limits (expires_at);

-- Grant the application runtime role access to this table.
-- SELECT/INSERT/UPDATE for normal operation; DELETE for probabilistic cleanup of expired rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bulldogs_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE dbo.auth_rate_limits
      TO bulldogs_app_runtime;
  END IF;
END $$;
