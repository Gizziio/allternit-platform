#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001)
run_id=$(echo "$out" | $PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["run_id"])')

run_path=".allternit/run_state/${run_id}.json"

$PYTHON_BIN - <<PY
import json
from pathlib import Path
path = Path("${run_path}")
state = json.loads(path.read_text())
for node in state.get("node_states", []):
    if node.get("task_id") == "T0000":
        node["status"] = "SUCCEEDED"
path.write_text(json.dumps(state, indent=2))
PY

set +e
out=$($PYTHON_BIN scripts/taskgraph.py resume "$run_id" 2>&1)
status=$?
set -e

rm -f "$run_path"

if [ "$status" -eq 0 ]; then
  echo "Expected resume to fail without node receipt" >&2
  exit 1
fi

if ! echo "$out" | grep -q "Missing receipt for completed node"; then
  echo "Expected missing receipt error, got:" >&2
  echo "$out" >&2
  exit 1
fi

echo "$out"
