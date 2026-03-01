#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

registry="workers/worker_registry.json"

if [ ! -f "$registry" ]; then
  echo "Expected worker registry to exist at $registry" >&2
  exit 1
fi

$PYTHON_BIN scripts/validate_law.py

bash tests/acceptance/test_worker_registry_required.sh

if [ ! -f "$registry" ]; then
  echo "Expected worker registry to be restored at $registry" >&2
  exit 1
fi

$PYTHON_BIN scripts/validate_law.py
