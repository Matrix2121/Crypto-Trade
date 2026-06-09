# Apply schema.sql when the connected Postgres DB is missing or outdated.
# Backs up with pg_dump before upgrading an existing database.
param(
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $env:DB_PORT,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USER,
    [string]$DbPassword = $env:DB_PASSWORD
)

$ErrorActionPreference = "Stop"

if (-not $DbHost) { $DbHost = "localhost" }
if (-not $DbPort) { $DbPort = "5433" }
if (-not $DbName) { $DbName = "postgres" }
if (-not $DbUser) { $DbUser = "postgres" }
if (-not $DbPassword) { $DbPassword = "root" }

$RepoRoot = Split-Path $PSScriptRoot -Parent
$SchemaFile = Join-Path $RepoRoot "backend\src\main\resources\db\schema.sql"
$VersionFile = Join-Path $RepoRoot "backend\src\main\resources\db\schema.version"
$BackupDir = Join-Path $RepoRoot "backups"

$env:PGPASSWORD = $DbPassword
$TargetVersion = (Get-Content $VersionFile -Raw).Trim()

function Invoke-Psql {
    param([string]$Query)
    & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -tAc $Query
}

function Wait-ForDb {
    Write-Host "Waiting for PostgreSQL at ${DbHost}:${DbPort}..."
    for ($i = 0; $i -lt 60; $i++) {
        & pg_isready -h $DbHost -p $DbPort -U $DbUser -d $DbName 2>$null
        if ($LASTEXITCODE -eq 0) { return }
        Start-Sleep -Seconds 2
    }
    throw "Database not ready after 120s"
}

Wait-ForDb

$hasMeta = Invoke-Psql "SELECT to_regclass('public.schema_meta') IS NOT NULL"
if ($hasMeta.Trim() -eq "t") {
    $installed = [int](Invoke-Psql "SELECT COALESCE(MAX(version), 0) FROM schema_meta").Trim()
} else {
    $installed = 0
}

$tablesOk = (Invoke-Psql @"
SELECT COUNT(*) = 4
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'predictions', 'market_events', 'ohlc_data')
"@).Trim()

$reason = $null
if ($tablesOk -ne "t") {
    $reason = "core tables missing"
} elseif ($installed -lt [int]$TargetVersion) {
    $reason = "schema version $installed < $TargetVersion"
}

if (-not $reason) {
    Write-Host "Schema OK (version $installed). No migration needed."
    exit 0
}

Write-Host "Migration required: $reason"

$hasData = (Invoke-Psql @"
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
"@).Trim()

if ($hasData -eq "t") {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    $stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
    $backupFile = Join-Path $BackupDir "pre-schema-v${TargetVersion}-${stamp}.dump"
    Write-Host "Backing up database to $backupFile"
    & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -Fc -f $backupFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
    Write-Host "Backup complete."
} else {
    Write-Host "Empty database — skipping backup."
}

Write-Host "Applying schema from $SchemaFile"
& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $SchemaFile
if ($LASTEXITCODE -ne 0) { throw "schema.sql failed" }

& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -c @"
INSERT INTO schema_meta (id, version, applied_at)
VALUES (1, $TargetVersion, NOW())
ON CONFLICT (id) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = EXCLUDED.applied_at;
"@
if ($LASTEXITCODE -ne 0) { throw "schema_meta update failed" }

Write-Host "Schema version $TargetVersion applied."
