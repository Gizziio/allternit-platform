#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

wih_file=".allternit/wih/T0000.wih.json"
backup="${wih_file}.bak"

cp "$wih_file" "$backup"

"$PYTHON_BIN" - <<'PY'
import json
from pathlib import Path
path = Path('.allternit/wih/T0000.wih.json')
obj = json.loads(path.read_text())
obj.setdefault('tools', {}).setdefault('allowlist', []).append('tool.invalid')
path.write_text(json.dumps(obj, indent=2))
PY

set +e
"$PYTHON_BIN" scripts/validate_law.py
status=$?
set -e

mv "$backup" "$wih_file"

if [ "$status" -eq 0 ]; then
  echo "Expected validator failure for invalid tool id"
  exit 1
fi
