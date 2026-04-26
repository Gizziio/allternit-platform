#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001)
run_id=$(echo "$out" | $PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["run_id"])')

resume_out=$($PYTHON_BIN scripts/taskgraph.py resume "$run_id")

next_nodes=$(echo "$resume_out" | $PYTHON_BIN -c 'import json,sys; print(" ".join(sorted(json.load(sys.stdin).get("next_nodes", []))))')

if echo "$next_nodes" | grep -q "T0001"; then
  echo "Expected T0001 blocked, got next_nodes: $next_nodes" >&2
  rm -f ".allternit/run_state/${run_id}.json"
  exit 1
fi

if ! echo "$next_nodes" | grep -q "T0000"; then
  echo "Expected T0000 runnable, got next_nodes: $next_nodes" >&2
  rm -f ".allternit/run_state/${run_id}.json"
  exit 1
fi

rm -f ".allternit/run_state/${run_id}.json"
