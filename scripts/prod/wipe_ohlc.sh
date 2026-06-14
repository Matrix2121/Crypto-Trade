#!/usr/bin/env bash
# Wipe all OHLC tables and refresh Timescale continuous aggregates.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

if [[ "${1:-}" != "--confirm-wipe" ]]; then
  echo "This deletes all OHLC history (ohlc_1m, ohlc_1d, legacy ohlc_data)."
  echo "Users, portfolios, predictions, and RAG events are kept."
  echo ""
  echo "Re-run with: $0 --confirm-wipe"
  exit 1
fi

wait_for_db
run_ml_script sync_kraken_history.py --wipe-only --confirm-wipe
