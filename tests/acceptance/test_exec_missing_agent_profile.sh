#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

set +e
out=$($PYTHON_BIN scripts/taskgraph.py install graph-0001 --agent-profile missing-profile 2>&1)
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "Expected failure for missing agent profile" >&2
  exit 1
fi

if ! echo "$out" | grep -q "Unknown agent profile"; then
  echo "Expected unknown agent profile error, got:" >&2
  echo "$out" >&2
  exit 1
fi

echo "$out"
