#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

registry="workers/worker_registry.json"
backup="${registry}.bak"

if [ ! -f "$registry" ]; then
  echo "Expected worker registry to exist at $registry" >&2
  exit 1
fi

restore_registry() {
  if [ -f "$backup" ]; then
    mv "$backup" "$registry"
  fi
}

trap restore_registry EXIT

mv "$registry" "$backup"

set +e
out=$("$PYTHON_BIN" scripts/validate_law.py 2>&1)
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "Expected validator failure when worker registry is missing"
  exit 1
fi

if ! echo "$out" | grep -q "Missing required anchors"; then
  echo "Expected missing anchors error, got:" >&2
  echo "$out" >&2
  exit 1
fi

if ! echo "$out" | grep -q "workers/worker_registry.json"; then
  echo "Expected workers/worker_registry.json in error output, got:" >&2
  echo "$out" >&2
  exit 1
fi

restore_registry
trap - EXIT

if [ ! -f "$registry" ]; then
  echo "Expected worker registry to be restored at $registry" >&2
  exit 1
fi

echo "$out"
