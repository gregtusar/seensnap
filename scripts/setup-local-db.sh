#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT_DIR}/apps/api"
VENV_DIR="${ROOT_DIR}/.venv"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_ADMIN_USER="${DB_ADMIN_USER:-postgres}"
DB_ADMIN_DB="${DB_ADMIN_DB:-postgres}"
APP_DB_USER="${APP_DB_USER:-postgres}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-postgres}"
APP_DB_NAME="${APP_DB_NAME:-seensnap}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed or not on PATH."
  echo "Install PostgreSQL locally first, then re-run this script."
  exit 1
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Missing virtual environment at ${VENV_DIR}"
  echo "Create it first with:"
  echo "  python3.12 -m venv .venv"
  echo "  .venv/bin/pip install -e 'apps/api[dev]'"
  exit 1
fi

if [[ ! -f "${API_DIR}/.env" ]]; then
  echo "Missing ${API_DIR}/.env"
  echo "Copy ${API_DIR}/.env.example to ${API_DIR}/.env first."
  exit 1
fi

export PGPASSWORD="${PGPASSWORD:-}"

echo "Ensuring role ${APP_DB_USER} exists..."
psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_ADMIN_USER}" \
  -d "${DB_ADMIN_DB}" \
  -v ON_ERROR_STOP=1 \
  -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_DB_USER}') THEN CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}'; ELSE ALTER ROLE ${APP_DB_USER} WITH LOGIN PASSWORD '${APP_DB_PASSWORD}'; END IF; END \$\$;"

echo "Ensuring database ${APP_DB_NAME} exists..."
psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_ADMIN_USER}" \
  -d "${DB_ADMIN_DB}" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT 'CREATE DATABASE ${APP_DB_NAME} OWNER ${APP_DB_USER}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${APP_DB_NAME}')\gexec"

echo "Granting privileges..."
psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_ADMIN_USER}" \
  -d "${APP_DB_NAME}" \
  -v ON_ERROR_STOP=1 \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${APP_DB_NAME} TO ${APP_DB_USER};"

echo "Running Alembic migrations..."
cd "${API_DIR}"
source "${VENV_DIR}/bin/activate"
alembic upgrade head

echo "Done. Local database is ready."
