#!/bin/bash

# T0410 - Gateway Registry Runtime Load Acceptance Test

set -e

REPO_ROOT=$(pwd)
GATEWAY_SCRIPT="services/gateway/src/main.py"
REGISTRY_PATH="infra/gateway/gateway_registry.json"
BACKUP_PATH="infra/gateway/gateway_registry.json.bak"
VENV_PYTHON=".venv-gateway/bin/python3"

# Select python
if [ -f "$VENV_PYTHON" ]; then
    PYTHON="$VENV_PYTHON"
else
    PYTHON="python3"
fi

# Ensure we are in repo root
if [ ! -f "SOT.md" ]; then
    echo "Error: Must run from repo root"
    exit 1
fi

echo "--- [T0410] Testing Gateway Registry Loading ---"

# 1. Test Success Case
echo "1. Testing valid registry load..."
$PYTHON "$GATEWAY_SCRIPT" > /dev/null
if [ $? -eq 0 ]; then
    echo "PASS: Registry loaded successfully."
else
    echo "FAIL: Registry failed to load."
    exit 1
fi

# 2. Test Missing Registry
echo "2. Testing missing registry..."
mv "$REGISTRY_PATH" "$BACKUP_PATH"

set +e
$PYTHON "$GATEWAY_SCRIPT" > /dev/null 2>&1
EXIT_CODE=$?
set -e

# Restore registry
mv "$BACKUP_PATH" "$REGISTRY_PATH"

if [ $EXIT_CODE -ne 0 ]; then
    echo "PASS: Registry load failed as expected when missing (Exit Code: $EXIT_CODE)."
else
    echo "FAIL: Registry load succeeded but should have failed (Missing File)."
    exit 1
fi

# 3. Test Invalid JSON
echo "3. Testing invalid JSON..."
mv "$REGISTRY_PATH" "$BACKUP_PATH"
echo "{ invalid_json: " > "$REGISTRY_PATH"

set +e
$PYTHON "$GATEWAY_SCRIPT" > /dev/null 2>&1
EXIT_CODE=$?
set -e

# Restore registry
rm "$REGISTRY_PATH"
mv "$BACKUP_PATH" "$REGISTRY_PATH"

if [ $EXIT_CODE -ne 0 ]; then
    echo "PASS: Registry load failed as expected with invalid JSON (Exit Code: $EXIT_CODE)."
else
    echo "FAIL: Registry load succeeded but should have failed (Invalid JSON)."
    exit 1
fi

echo "--- [T0410] All Tests Passed ---"
