$ErrorActionPreference = "Stop"
$containerName = "bulldogs-phase10-role-probe"
$existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $containerName }
if ($existing) { throw "Disposable probe container already exists." }

$adminPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace("/", "A").Replace("+", "B")
$runtimePassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace("/", "C").Replace("+", "D")

try {
  docker run --name $containerName -e "POSTGRES_PASSWORD=$adminPassword" -d postgres:17-alpine | Out-Null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker exec -e "PGPASSWORD=$adminPassword" $containerName pg_isready -U postgres | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  if ($LASTEXITCODE -ne 0) { throw "Disposable PostgreSQL did not become ready." }

  @'
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS vault;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE supabase_auth_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
'@ | docker exec -i -e "PGPASSWORD=$adminPassword" $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Local Supabase-role bootstrap failed." }

  $migrationCount = 0
  foreach ($file in Get-ChildItem "supabase\migrations\*.sql" | Sort-Object Name) {
    Get-Content -LiteralPath $file.FullName -Raw | docker exec -i -e "PGPASSWORD=$adminPassword" $containerName psql -v ON_ERROR_STOP=1 -U postgres -d postgres | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Migration validation failed: $($file.Name)" }
    $migrationCount++
  }

  Get-Content -LiteralPath "database\postgres\005_application_runtime_role.sql" -Raw |
    docker exec -i -e "PGPASSWORD=$adminPassword" $containerName psql -v ON_ERROR_STOP=1 -v "runtime_password=$runtimePassword" -U postgres -d postgres | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Application role setup failed." }

  @'
SELECT current_user='bulldogs_app_runtime',
  has_table_privilege(current_user,'dbo.categories','SELECT'),
  has_table_privilege(current_user,'dbo.reservations','INSERT'),
  NOT has_table_privilege(current_user,'dbo.categories','DELETE'),
  NOT has_schema_privilege(current_user,'auth','USAGE'),
  NOT has_schema_privilege(current_user,'vault','USAGE'),
  NOT has_schema_privilege(current_user,'dbo','CREATE'),
  NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb
FROM pg_roles r WHERE r.rolname=current_user;
BEGIN;
INSERT INTO dbo.categories(categoryname) VALUES('Phase 10 permission probe');
ROLLBACK;
'@ | docker exec -i -e "PGPASSWORD=$runtimePassword" $containerName psql -v ON_ERROR_STOP=1 -U bulldogs_app_runtime -d postgres -t -A |
    Tee-Object -Variable probeOutput | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not ($probeOutput -contains "t|t|t|t|t|t|t|t")) { throw "Runtime permission probe failed." }

  Write-Output "LOCAL_MIGRATIONS_APPLIED=$migrationCount"
  Write-Output "ROLE_PROBE=PASS"
  Write-Output "WRITE_PROBE=TRANSACTION_ROLLED_BACK"
}
finally {
  $adminPassword = $null
  $runtimePassword = $null
  if (docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $containerName }) {
    docker rm -f $containerName | Out-Null
  }
  [GC]::Collect()
}
