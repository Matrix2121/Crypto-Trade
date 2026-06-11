#!/usr/bin/env bash
# Shared helpers for production maintenance scripts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

: "${DB_USER:?Set DB_USER in .env}"
: "${DB_PASSWORD:?Set DB_PASSWORD in .env}"
: "${DB_NAME:?Set DB_NAME in .env}"

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="${DB_PASSWORD}"

COMPOSE=(docker compose -f "${REPO_ROOT}/docker-compose.yaml")

dc() {
  "${COMPOSE[@]}" "$@"
}

psql_db() {
  dc exec -T db psql -U "${DB_USER}" -d "${DB_NAME}" "$@"
}

wait_for_db() {
  echo "Waiting for PostgreSQL (${DB_HOST}:${DB_PORT})..."
  for _ in $(seq 1 60); do
    if dc exec -T db pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "ERROR: database not ready after 120s" >&2
  exit 1
}

run_ml_script() {
  local script_name="$1"
  shift
  dc run --rm --no-deps ml-service \
    python "/app/scripts/${script_name}" "$@"
}
