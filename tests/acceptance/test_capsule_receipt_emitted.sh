#!/bin/bash

# T0503 - Capsule Receipt Emitted Acceptance Test

set -e

REPO_ROOT=$(pwd)
RUNTIME_SCRIPT="services/capsule-runtime/src/main.py"
REGISTRY_PATH="capsules/capsule_registry.json"
BACKUP_PATH="capsules/capsule_registry.json.bak"
VENV_PYTHON=".venv-capsule/bin/python3"
PORT=3067
PID_FILE="capsule_t0503_receipt.pid"
RUN_ID="test-t0503-receipt"
RECEIPT_DIR=".a2r/receipts/$RUN_ID"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: .venv-capsule missing."
    exit 1
fi

echo "--- [T0503] Testing Capsule Receipts ---"

# Clean previous receipts
rm -rf "$RECEIPT_DIR"

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

export A2R_RUN_ID="$RUN_ID"
export PORT=$PORT
$VENV_PYTHON "$RUNTIME_SCRIPT" > capsule_runtime_receipt.log 2>&1 &
echo $! > $PID_FILE
sleep 3

# Trigger action (Denied)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"tool_id": "fs.write", "arguments": {}}' \
  http://localhost:$PORT/v1/capsule/test-capsule/tool_call > /dev/null

# Check Receipt
RECEIPT_FILE=$(ls $RECEIPT_DIR/capsule-*.json 2>/dev/null | head -n 1)

if [ -z "$RECEIPT_FILE" ]; then
    echo "FAIL: No receipt file found."
    kill $(cat $PID_FILE)
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
    rm $PID_FILE
    exit 1
fi

echo "Found receipt: $RECEIPT_FILE"

# Validate Schema
$VENV_PYTHON -c "
import json
import jsonschema
import sys

with open('$RECEIPT_FILE', 'r') as f:
    data = json.load(f)

with open('spec/Contracts/CapsuleReceipt.schema.json', 'r') as f:
    schema = json.load(f)

try:
    jsonschema.validate(instance=data, schema=schema)
    print('Receipt schema valid.')
except Exception as e:
    print(f'Receipt schema invalid: {e}')
    sys.exit(1)

if data['status'] != 'denied':
    print('Expected status=denied')
    sys.exit(1)
if data['capsule_id'] != 'test-capsule':
    print('Expected capsule_id=test-capsule')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo "PASS: Receipt valid."
else
    echo "FAIL: Receipt validation failed."
    kill $(cat $PID_FILE)
    mv "$BACKUP_PATH" "$REGISTRY_PATH"
    rm $PID_FILE
    exit 1
fi

# Cleanup
kill $(cat $PID_FILE)
rm $PID_FILE
mv "$BACKUP_PATH" "$REGISTRY_PATH"
rm capsule_runtime_receipt.log
rm -rf "$RECEIPT_DIR"

echo "--- [T0503] Receipt Tests Passed ---"
