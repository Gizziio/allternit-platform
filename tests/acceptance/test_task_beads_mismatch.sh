#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

wih_file=".allternit/wih/T0004.wih.json"
backup="${wih_file}.bak"

if [ ! -f "$wih_file" ]; then
  echo "Expected WIH file to exist at $wih_file" >&2
  exit 1
fi

restore_wih() {
  if [ -f "$backup" ]; then
    mv "$backup" "$wih_file"
  fi
}

trap restore_wih EXIT

cp "$wih_file" "$backup"

$PYTHON_BIN - <<'PY'
import json
from pathlib import Path
path = Path('.allternit/wih/T0004.wih.json')
obj = json.loads(path.read_text())
beads = obj.get('beads', {})
beads['blocked_by'] = ['T0009']
obj['beads'] = beads
path.write_text(json.dumps(obj, indent=2))
PY

set +e
out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001 2>&1)
status=$?
set -e

mv "$backup" "$wih_file"

if [ "$status" -eq 0 ]; then
  echo "Expected install to fail on beads mismatch" >&2
  exit 1
fi

if ! echo "$out" | grep -q "Beads.blocked_by mismatch"; then
  echo "Expected Beads.blocked_by mismatch error, got:" >&2
  echo "$out" >&2
  exit 1
fi

restore_wih
trap - EXIT

if [ ! -f "$wih_file" ]; then
  echo "Expected WIH file to be restored at $wih_file" >&2
  exit 1
fi

echo "$out"
