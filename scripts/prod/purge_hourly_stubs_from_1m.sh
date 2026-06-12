#!/usr/bin/env bash
# Remove isolated hourly OHLC rows from ohlc_1m (no adjacent 1-minute neighbor).
# These stubs come from Kraken hourly backfill and cause empty :30-:00 windows on 1D charts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

wait_for_db

echo "Deleting hourly-only stubs from ohlc_1m (no minute before/after)..."
psql_db -c "
DELETE FROM ohlc_1m a
WHERE NOT EXISTS (
    SELECT 1 FROM ohlc_1m b
    WHERE b.symbol = a.symbol
      AND b.bucket = a.bucket - INTERVAL '1 minute'
)
AND NOT EXISTS (
    SELECT 1 FROM ohlc_1m b
    WHERE b.symbol = a.symbol
      AND b.bucket = a.bucket + INTERVAL '1 minute'
);
"

echo "Done. Re-run market data sync if 1D chart still has gaps:"
echo "  Admin panel -> Sync market data"
