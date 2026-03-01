#!/bin/bash

# T0412 - Gateway Routing Receipt Emitted

set -e

REPO_ROOT=$(pwd)
GATEWAY_PORT=3098
VENV_PYTHON=".venv-gateway/bin/python3"
PID_FILE="gateway_t0412.pid"
RECEIPT_DIR=".a2r/receipts/test-t0412"

# Ensure venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: .venv-gateway missing."
    exit 1
fi

echo "--- [T0412] Testing Gateway Routing Receipt ---"

# Cleanup previous run
rm -rf "$RECEIPT_DIR"
mkdir -p "$RECEIPT_DIR"

export GATEWAY_PORT=$GATEWAY_PORT
export A2R_RUN_ID="test-t0412"
export PYTHONPATH=$REPO_ROOT

# Start Gateway
$VENV_PYTHON -m uvicorn services.gateway.src.main:app --host 127.0.0.1 --port $GATEWAY_PORT > gateway_t0412.log 2>&1 &
echo $! > $PID_FILE

sleep 5

# Make a request
curl -s "http://127.0.0.1:$GATEWAY_PORT/" > /dev/null

# Check for receipt
RECEIPT_FILE=$(ls $RECEIPT_DIR/gateway-*.json | head -n 1)

if [ -z "$RECEIPT_FILE" ]; then
    echo "FAIL: No receipt file found in $RECEIPT_DIR"
    kill $(cat $PID_FILE)
    rm $PID_FILE
    exit 1
fi

echo "Found receipt: $RECEIPT_FILE"

# Validate Receipt Schema using Python
$VENV_PYTHON -c "
import json
import jsonschema
import sys

with open('$RECEIPT_FILE', 'r') as f:
    data = json.load(f)

with open('spec/Contracts/GatewayRoutingReceipt.schema.json', 'r') as f:
    schema = json.load(f)

try:
    jsonschema.validate(instance=data, schema=schema)
    print('Receipt schema valid.')
except Exception as e:
    print(f'Receipt schema invalid: {e}')
    sys.exit(1)

# Check specific fields
if data['status_code'] != 200:
    print('Expected status_code=200')
    sys.exit(1)
if 'gateway_id' not in data:
    print('Missing gateway_id')
    sys.exit(1)
if 'registry_hash' in data:
    print('registry_hash should NOT be present (schema additionalProperties=false)')
    sys.exit(1)
"

if [ $? -eq 0 ]; then
    echo "PASS: Receipt valid and fields correct."
else
    echo "FAIL: Receipt validation failed."
    kill $(cat $PID_FILE)
    rm $PID_FILE
    exit 1
fi

# Cleanup
kill $(cat $PID_FILE)
rm $PID_FILE
rm gateway_t0412.log
rm -rf "$RECEIPT_DIR"

echo "--- [T0412] All Tests Passed ---"
