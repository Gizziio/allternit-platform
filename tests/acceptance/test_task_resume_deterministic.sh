#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001)
run_id=$(echo "$out" | $PYTHON_BIN -c 'import json,sys; print(json.load(sys.stdin)["run_id"])')

out1=$($PYTHON_BIN scripts/taskgraph.py resume "$run_id")
out2=$($PYTHON_BIN scripts/taskgraph.py resume "$run_id")

if [ "$out1" != "$out2" ]; then
  echo "Resume output not deterministic" >&2
  echo "$out1" >&2
  echo "$out2" >&2
  rm -f ".allternit/run_state/${run_id}.json"
  exit 1
fi

rm -f ".allternit/run_state/${run_id}.json"
