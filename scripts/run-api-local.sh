#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
API_DIR="${ROOT_DIR}/apps/api"
ENV_FILE="${API_DIR}/.env"

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Missing virtual environment at ${VENV_DIR}"
  echo "Create it first with:"
  echo "  python3 -m venv .venv"
  echo "  .venv/bin/pip install -e 'apps/api[dev]'"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing backend env file at ${ENV_FILE}"
  echo "Copy apps/api/.env.example to apps/api/.env and fill in the required values."
  exit 1
fi

cd "${API_DIR}"
source "${VENV_DIR}/bin/activate"

echo "Starting SeenSnap API on http://127.0.0.1:8000"
exec uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

