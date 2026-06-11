#!/usr/bin/env bash
# Restore non-OHLC application data from a pg_dump custom-format backup.
# Use after a fresh TimescaleDB volume when you need users / portfolios / RAG back.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.dump>" >&2
  echo "Restores: users, assets, transactions, user_favorite, tracked_asset, predictions, market_events" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

wait_for_db

echo "Copying backup into db container..."
dc cp "${BACKUP_FILE}" "db:/tmp/restore.dump"

echo "Restoring application data from ${BACKUP_FILE}"
dc exec -T db pg_restore \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  -t users \
  -t assets \
  -t transactions \
  -t user_favorite \
  -t tracked_asset \
  -t predictions \
  -t market_events \
  /tmp/restore.dump

dc exec -T db rm -f /tmp/restore.dump

echo "Restore complete. Row counts:"
psql_db -c "
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'predictions', COUNT(*) FROM predictions
UNION ALL SELECT 'market_events', COUNT(*) FROM market_events;
"
