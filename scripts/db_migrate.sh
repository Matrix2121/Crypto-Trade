#!/usr/bin/env bash
# Apply backend/src/main/resources/db/schema.sql when the live DB is missing or outdated.
# Backs up with pg_dump before upgrading an existing database (never on empty DB).
set -euo pipefail

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:?DB_NAME is required}"
DB_USER="${DB_USER:?DB_USER is required}"
export PGPASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCHEMA_FILE="${SCHEMA_FILE:-${REPO_ROOT}/backend/src/main/resources/db/schema.sql}"
VERSION_FILE="${VERSION_FILE:-${REPO_ROOT}/backend/src/main/resources/db/schema.version}"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"

TARGET_VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"

psql_base() {
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" "$@"
}

wait_for_db() {
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  for _ in $(seq 1 60); do
    if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: database not ready after 120s" >&2
  exit 1
}

current_version() {
  local has_meta
  has_meta="$(psql_base -tAc "SELECT to_regclass('public.schema_meta') IS NOT NULL")"
  if [[ "${has_meta}" != "t" ]]; then
    echo "0"
    return
  fi
  psql_base -tAc "SELECT COALESCE(MAX(version), 0) FROM schema_meta"
}

core_tables_present() {
  psql_base -tAc "
    SELECT COUNT(*) = 4
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'predictions', 'market_events', 'ohlc_1m')
  "
}

has_existing_data() {
  psql_base -tAc "
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    )
  "
}

backup_database() {
  mkdir -p "${BACKUP_DIR}"
  local stamp file
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="${BACKUP_DIR}/pre-schema-v${TARGET_VERSION}-${stamp}.dump"
  echo "Backing up database to ${file}"
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fc -f "${file}"
  echo "Backup complete ($(du -h "${file}" | cut -f1))"
}

apply_schema() {
  echo "Applying schema from ${SCHEMA_FILE}"
  psql_base -v ON_ERROR_STOP=1 -f "${SCHEMA_FILE}"
  psql_base -v ON_ERROR_STOP=1 -c "
    INSERT INTO schema_meta (id, version, applied_at)
    VALUES (1, ${TARGET_VERSION}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET version = EXCLUDED.version,
          applied_at = EXCLUDED.applied_at;
  "
  echo "Schema version ${TARGET_VERSION} applied."
}

main() {
  if [[ ! -f "${SCHEMA_FILE}" ]]; then
    echo "ERROR: schema file not found: ${SCHEMA_FILE}" >&2
    exit 1
  fi
  if [[ ! -f "${VERSION_FILE}" ]]; then
    echo "ERROR: version file not found: ${VERSION_FILE}" >&2
    exit 1
  fi

  wait_for_db

  local installed tables_ok reason=""
  installed="$(current_version)"
  tables_ok="$(core_tables_present)"

  if [[ "${tables_ok}" != "t" ]]; then
    reason="core tables missing"
  elif [[ "${installed}" -lt "${TARGET_VERSION}" ]]; then
    reason="schema version ${installed} < ${TARGET_VERSION}"
  fi

  if [[ -z "${reason}" ]]; then
    echo "Schema OK (version ${installed}, core tables present). No migration needed."
    exit 0
  fi

  echo "Migration required: ${reason}"

  if [[ "$(has_existing_data)" == "t" ]]; then
    backup_database
  else
    echo "Empty database — skipping backup."
  fi

  apply_schema
}

main "$@"
