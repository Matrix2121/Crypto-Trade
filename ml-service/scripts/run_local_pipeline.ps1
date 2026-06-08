# Full local ML pipeline: fetch OHLC -> train -> seed RAG -> export SQL
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$env:PYTHONPATH = Join-Path $Root "ml-service"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Scripts = Join-Path $Root "ml-service\scripts"

& $Python (Join-Path $Scripts "fetch_missing_ohlc.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $Scripts "train_all.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $Scripts "seed_rag.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $Scripts "export_rag.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone. Commit artifacts + deploy/market_events_seed.sql, then follow ml-service/DEPLOY.md"
