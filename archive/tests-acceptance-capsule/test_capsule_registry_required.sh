#!/bin/bash

# T0503 - Capsule Registry Required Acceptance Test

set -e

REPO_ROOT=$(pwd)
RUNTIME_SCRIPT="services/capsule-runtime/src/main.py"
REGISTRY_PATH="capsules/capsule_registry.json"
BACKUP_PATH="capsules/capsule_registry.json.bak"
VENV_PYTHON=".venv-capsule/bin/python3"

# Setup venv if missing (minimal check)
if [ ! -f "$VENV_PYTHON" ]; then
    echo "Creating venv..."
    python3 -m venv .venv-capsule
    .venv-capsule/bin/pip install -r services/capsule-runtime/requirements.txt > /dev/null
fi

PYTHON="$VENV_PYTHON"

echo "--- [T0503] Testing Capsule Registry Required ---"

# 1. Test Valid Load
echo "1. Testing valid registry load..."
$PYTHON "$RUNTIME_SCRIPT" > /dev/null 2>&1 &
PID=$!
sleep 2
if ps -p $PID > /dev/null; then
    echo "PASS: Runtime started."
    kill $PID
else
    echo "FAIL: Runtime failed to start."
    exit 1
fi

# 2. Test Missing Registry
echo "2. Testing missing registry..."
mv "$REGISTRY_PATH" "$BACKUP_PATH"

$PYTHON "$RUNTIME_SCRIPT" > /dev/null 2>&1 &
PID=$!
sleep 2
if ps -p $PID > /dev/null; then
    echo "FAIL: Runtime started without registry."
    kill $PID
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
    exit 1
else
    echo "PASS: Runtime failed to start (good)."
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
fi

echo "--- [T0503] All Tests Passed ---"
