#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

registry="infra/gateway/gateway_registry.json"
backup="${registry}.bak"

mv "$registry" "$backup"

set +e
"$PYTHON_BIN" scripts/validate_law.py
status=$?
set -e

mv "$backup" "$registry"

if [ "$status" -eq 0 ]; then
  echo "Expected validator failure when gateway registry is missing" >&2
  exit 1
fi
