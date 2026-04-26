#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001)
run_id=$(echo "$out" | $PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["run_id"])')
receipt_dir=".allternit/receipts/${run_id}"
if ! ls "${receipt_dir}"/agent-exec-*.json >/dev/null 2>&1; then
  echo "Missing agent execution receipt in ${receipt_dir}" >&2
  exit 1
fi

$PYTHON_BIN - <<PY
import json
from pathlib import Path
import glob
run_id = "${run_id}"
paths = glob.glob(f".allternit/receipts/{run_id}/agent-exec-*.json")
if not paths:
    raise SystemExit("No agent execution receipt found")
receipt = json.loads(Path(paths[0]).read_text())
for key in ("receipt_id", "created_at", "run_id", "graph_id", "agent_profile_id", "status"):
    if key not in receipt:
        raise SystemExit(f"Missing {key} in receipt")
if receipt["run_id"] != run_id:
    raise SystemExit("run_id mismatch in receipt")
PY

rm -f ".allternit/run_state/${run_id}.json"
rm -rf "${receipt_dir}"
