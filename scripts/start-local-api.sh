#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
API_DIR="${ROOT_DIR}/apps/api"
ENV_FILE="${API_DIR}/.env"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Missing virtual environment at ${VENV_DIR}"
  echo "Create it with:"
  echo "  python3 -m venv .venv"
  echo "  .venv/bin/pip install -e 'apps/api[dev]'"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing backend env file at ${ENV_FILE}"
  echo "Copy apps/api/.env.example to apps/api/.env and set DATABASE_URL."
  exit 1
fi

cd "${API_DIR}"
source "${VENV_DIR}/bin/activate"

if [[ "${SKIP_MIGRATIONS}" != "1" ]]; then
  echo "Applying database migrations"
  alembic upgrade head
else
  echo "Skipping database migrations because SKIP_MIGRATIONS=1"
fi

echo "Starting SeenSnap API on http://${HOST}:${PORT}"
exec uvicorn app.main:app --host "${HOST}" --port "${PORT}" --reload
