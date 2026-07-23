#!/bin/bash

# T0503 - Capsule Permission Denied Acceptance Test

set -e

REPO_ROOT=$(pwd)
RUNTIME_SCRIPT="services/capsule-runtime/src/main.py"
REGISTRY_PATH="capsules/capsule_registry.json"
BACKUP_PATH="capsules/capsule_registry.json.bak"
VENV_PYTHON=".venv-capsule/bin/python3"
PORT=3066
PID_FILE="capsule_t0503_perm.pid"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: .venv-capsule missing."
    exit 1
fi

echo "--- [T0503] Testing Capsule Permissions ---"

# Backup and Inject Registry
cp "$REGISTRY_PATH" "$BACKUP_PATH"
cat > "$REGISTRY_PATH" <<EOF
{
  "registry_version": "v0.1",
  "capsules": [
    {
      "capsule_id": "test-capsule",
      "version": "v0.1.0",
      "name": "Test Capsule",
      "kind": "native_capsule",
      "entrypoint": "echo hello",
      "permissions": {
        "network_allowlist": [],
        "tool_allowlist": ["fs.read"],
        "fs_read_allowlist": [],
        "fs_write_allowlist": []
      }
    }
  ]
}
EOF

export Allternit_RUN_ID="test-t0503-perm"
export PORT=$PORT
$VENV_PYTHON "$RUNTIME_SCRIPT" > capsule_runtime.log 2>&1 &
echo $! > $PID_FILE
sleep 3

# 1. Test Allowed Tool
echo "1. Testing allowed tool..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"tool_id": "fs.read", "arguments": {}}' \
  http://localhost:$PORT/v1/capsule/test-capsule/tool_call)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "PASS: Allowed tool succeeded."
else
    echo "FAIL: Allowed tool failed (Code: $HTTP_CODE)."
    cat capsule_runtime.log
    kill $(cat $PID_FILE)
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
    rm $PID_FILE
    exit 1
fi

# 2. Test Denied Tool
echo "2. Testing denied tool..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"tool_id": "fs.write", "arguments": {}}' \
  http://localhost:$PORT/v1/capsule/test-capsule/tool_call)

if [ "$HTTP_CODE" -eq 403 ]; then
    echo "PASS: Denied tool rejected."
else
    echo "FAIL: Denied tool allowed or error (Code: $HTTP_CODE)."
    cat capsule_runtime.log
    kill $(cat $PID_FILE)
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
    rm $PID_FILE
    exit 1
fi

# Cleanup
kill $(cat $PID_FILE)
rm $PID_FILE
mv "$BACKUP_PATH" "$REGISTRY_PATH"
rm capsule_runtime.log

echo "--- [T0503] Permission Tests Passed ---"
