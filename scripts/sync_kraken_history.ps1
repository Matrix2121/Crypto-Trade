# Download maximum Kraken OHLC history into the local TimescaleDB.
#
# Prerequisites:
#   - Docker DB running (default port 5434)
#   - ml-service/.env DB_* settings match the database
#   - Python venv at .venv with ml-service dependencies installed
#
# Examples:
#   .\scripts\sync_kraken_history.ps1
#   .\scripts\sync_kraken_history.ps1 -DailyOnly
#   .\scripts\sync_kraken_history.ps1 -Force
#   .\scripts\sync_kraken_history.ps1 -DryRun
param(
    [switch]$DailyOnly,
    [switch]$HourlyOnly,
    [switch]$Force,
    [switch]$SkipCaggRefresh,
    [switch]$DryRun,
    [switch]$Wipe,
    [switch]$WipeOnly,
    [switch]$ConfirmWipe,
    [string]$Symbols = "",
    [string]$HourlySymbols = "",
    [string]$LogFile = "sync_kraken_history.log"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$Script = Join-Path $RepoRoot "ml-service\scripts\sync_kraken_history.py"

if (-not (Test-Path $Python)) {
    throw "Python venv not found at $Python"
}

$env:PYTHONPATH = Join-Path $RepoRoot "ml-service"

$argsList = @()
if ($DailyOnly) { $argsList += "--daily-only" }
if ($HourlyOnly) { $argsList += "--hourly-only" }
if ($Force) { $argsList += "--force" }
if ($SkipCaggRefresh) { $argsList += "--skip-cagg-refresh" }
if ($DryRun) { $argsList += "--dry-run" }
if ($Wipe) { $argsList += "--wipe" }
if ($WipeOnly) { $argsList += "--wipe-only" }
if ($ConfirmWipe) { $argsList += "--confirm-wipe" }
if ($Symbols) { $argsList += "--symbols"; $argsList += $Symbols }
if ($HourlySymbols) { $argsList += "--hourly-symbols"; $argsList += $HourlySymbols }

$logPath = Join-Path $RepoRoot $LogFile
Write-Host "Logging to $logPath"
Write-Host "Started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

& $Python -u $Script @argsList 2>&1 | Tee-Object -FilePath $logPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
