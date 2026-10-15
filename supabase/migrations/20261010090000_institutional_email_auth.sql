-- Canonical institutional-email rules. Apply only after the read-only collision preflight.
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT canonical_email
    FROM (
      SELECT lower(btrim(COALESCE(
        NULLIF(btrim(schoolemail), ''),
        CASE WHEN lower(btrim(email)) ~ '^[^@[:space:]]+@(students\.)?nu-fairview\.edu\.ph$' THEN email END
      ))) canonical_email
      FROM dbo.users
    ) candidates
    WHERE canonical_email IS NOT NULL
    GROUP BY canonical_email
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Institutional email collisions must be resolved before migration';
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE dbo.users ADD CONSTRAINT ck_users_schoolemail_institutional_domain CHECK (
    schoolemail IS NULL OR (
      btrim(schoolemail) <> '' AND
      lower(btrim(schoolemail)) ~ '^[^@[:space:]]+@(students\.)?nu-fairview\.edu\.ph$'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_institutional_email_normalized
ON dbo.users (lower(btrim(COALESCE(
  NULLIF(btrim(schoolemail), ''),
  CASE WHEN lower(btrim(email)) ~ '^[^@[:space:]]+@(students\.)?nu-fairview\.edu\.ph$' THEN email END
))))
WHERE COALESCE(
  NULLIF(btrim(schoolemail), ''),
  CASE WHEN lower(btrim(email)) ~ '^[^@[:space:]]+@(students\.)?nu-fairview\.edu\.ph$' THEN email END
) IS NOT NULL;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS dbo.uq_users_institutional_email_normalized;
-- ALTER TABLE dbo.users DROP CONSTRAINT IF EXISTS ck_users_schoolemail_institutional_domain;
