#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
API_DIR="${ROOT_DIR}/apps/api"

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "Missing virtual environment at ${VENV_DIR}"
  exit 1
fi

cd "${API_DIR}"
source "${VENV_DIR}/bin/activate"
python -m app.services.demo_feed_seed
echo "Demo social feed seeded."
