#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001)
run_id=$(echo "$out" | $PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["run_id"])')

run_path=".a2r/run_state/${run_id}.json"
if [ ! -f "$run_path" ]; then
  echo "Missing run_state file: $run_path" >&2
  exit 1
fi

$PYTHON_BIN - <<PY
import json
from pathlib import Path
run_id = "${run_id}"
state = json.loads(Path(f".a2r/run_state/{run_id}.json").read_text())
node_states = {n["task_id"]: n["status"] for n in state.get("node_states", [])}
if node_states.get("T0000") != "PENDING":
    raise SystemExit("Expected T0000 PENDING")
if node_states.get("T0001") != "BLOCKED":
    raise SystemExit("Expected T0001 BLOCKED")
PY

rm -f "$run_path"
