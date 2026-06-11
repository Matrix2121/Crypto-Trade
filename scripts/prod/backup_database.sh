#!/usr/bin/env bash
# Full database backup before schema / OHLC migration.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib.sh"

BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
mkdir -p "${BACKUP_DIR}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/prod-full-${STAMP}.dump"

echo "Backing up ${DB_NAME} to ${BACKUP_FILE}"
dc exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${BACKUP_FILE}"
echo "Backup complete ($(du -h "${BACKUP_FILE}" | cut -f1))"
