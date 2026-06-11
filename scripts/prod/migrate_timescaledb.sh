#!/usr/bin/env bash
# Migrate production to TimescaleDB schema v2 and optionally refill OHLC from Kraken.
#
# Usage:
#   ./scripts/prod/migrate_timescaledb.sh              # schema only
#   ./scripts/prod/migrate_timescaledb.sh --sync       # schema + full Kraken OHLC sync
#   ./scripts/prod/migrate_timescaledb.sh --sync --wipe # wipe OHLC first, then sync
#   ./scripts/prod/migrate_timescaledb.sh --fresh-volume --sync  # destructive: new DB volume
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

DO_SYNC=0
DO_WIPE=0
FRESH_VOLUME=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync) DO_SYNC=1; shift ;;
    --wipe) DO_WIPE=1; shift ;;
    --fresh-volume) FRESH_VOLUME=1; shift ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--sync] [--wipe] [--fresh-volume]" >&2
      exit 1
      ;;
  esac
done

echo "=== Step 1: Backup ==="
"${SCRIPT_DIR}/backup_database.sh"

echo ""
echo "=== Step 2: Stop application containers ==="
dc stop backend ml-service frontend 2>/dev/null || true

if [[ "${FRESH_VOLUME}" -eq 1 ]]; then
  echo ""
  echo "=== Step 3: Recreate database volume (DESTRUCTIVE) ==="
  dc down
  docker volume rm cryptotrade_postgres_data 2>/dev/null \
    || docker volume rm crypto-trade_postgres_data 2>/dev/null \
    || echo "WARN: could not remove postgres volume — check 'docker volume ls'"
fi

echo ""
echo "=== Step 4: Build TimescaleDB image and start database ==="
dc build db
dc up -d db
wait_for_db

echo ""
echo "=== Step 5: Apply schema v2 (TimescaleDB hypertables + CAGGs) ==="
dc run --rm db-migrate

if [[ "${DO_SYNC}" -eq 1 ]]; then
  echo ""
  echo "=== Step 6: Rebuild ml-service (includes sync scripts) ==="
  dc build ml-service

  SYNC_ARGS=()
  if [[ "${DO_WIPE}" -eq 1 ]]; then
    SYNC_ARGS+=(--wipe)
  fi
  echo ""
  echo "=== Step 7: Sync full Kraken OHLC history (may take 30-90+ min) ==="
  "${SCRIPT_DIR}/sync_kraken_history.sh" "${SYNC_ARGS[@]}"
else
  echo ""
  echo "Skipping Kraken sync (pass --sync to run scripts/prod/sync_kraken_history.sh)"
fi

echo ""
echo "=== Step 8: Start full stack ==="
dc up -d --build

echo ""
echo "Migration complete."
echo "Next:"
echo "  - Import RAG seed if needed: docker compose exec -T db psql -U \$DB_USER -d \$DB_NAME < ml-service/deploy/market_events_seed.sql"
echo "  - Grant admin: UPDATE users SET is_admin = true WHERE email = 'you@example.com';"
echo "  - Admin panel: Sync market stats, Run hourly/daily predictions"
