#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

registry="infra/gateway/gateway_registry.json"
backup="${registry}.bak"

cp "$registry" "$backup"
$PYTHON_BIN - <<'PY'
import json
from pathlib import Path
path = Path("infra/gateway/gateway_registry.json")
reg = json.loads(path.read_text())
reg["external_ingress"] = [reg["external_ingress"], reg["external_ingress"]]
path.write_text(json.dumps(reg, indent=2))
PY

set +e
"$PYTHON_BIN" scripts/validate_law.py
status=$?
set -e

mv "$backup" "$registry"

if [ "$status" -eq 0 ]; then
  echo "Expected validator failure for multiple ingress" >&2
  exit 1
fi
