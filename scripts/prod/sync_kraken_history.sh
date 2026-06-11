#!/usr/bin/env bash
# Download maximum Kraken OHLC history into TimescaleDB (prod).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

WIPE=0
FORCE=0
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wipe)
      WIPE=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --daily-only)
      EXTRA_ARGS+=(--daily-only)
      shift
      ;;
    --hourly-only)
      EXTRA_ARGS+=(--hourly-only)
      shift
      ;;
    --dry-run)
      EXTRA_ARGS+=(--dry-run)
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

wait_for_db

ARGS=()
if [[ "${WIPE}" -eq 1 ]]; then
  ARGS+=(--wipe --confirm-wipe)
fi
if [[ "${FORCE}" -eq 1 ]]; then
  ARGS+=(--force)
fi
ARGS+=("${EXTRA_ARGS[@]}")

LOG="${REPO_ROOT}/sync_kraken_history.log"
echo "Logging to ${LOG}"
run_ml_script sync_kraken_history.py "${ARGS[@]}" 2>&1 | tee "${LOG}"
