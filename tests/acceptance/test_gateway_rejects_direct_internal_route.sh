#!/bin/bash

# T0411 - Name-based routing only (no raw host:port)

set -e

REPO_ROOT=$(pwd)
GATEWAY_SCRIPT="services/gateway/src/main.py"
GATEWAY_PORT=3099 # Use a different port to avoid conflict with real 3000
VENV_PYTHON=".venv-gateway/bin/python3"
PID_FILE="gateway_t0411.pid"

# Ensure venv exists
if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: .venv-gateway missing. Run T0410 setup first."
    exit 1
fi

echo "--- [T0411] Testing Gateway Rejects Direct/Raw Routes ---"

# Backup and create strict registry
cp infra/gateway/gateway_registry.json infra/gateway/gateway_registry.json.bak
cat > infra/gateway/gateway_registry.json <<EOF
{
  "version": "v0.1",
  "external_ingress": {
    "id": "test-gateway",
    "host": "localhost",
    "port": $GATEWAY_PORT,
    "protocol": "http",
    "routes": [
      {
        "path_prefix": "/api",
        "service": "kernel",
        "methods": ["GET", "POST"]
      }
    ]
  },
  "services": [
    {
      "name": "kernel",
      "internal_url": "http://kernel:3000",
      "exposed": false
    }
  ]
}
EOF

# Start Gateway
echo "Starting Gateway on port $GATEWAY_PORT..."
# We need to modify main.py to accept port arg or env var.
# For now, I'll pass it as a hack or just rely on main.py running uvicorn.run(..., port=3000)
# Wait, I hardcoded 3000. I should make it configurable.

# Let's patch main.py to read port from env var or args better.
# For now, I'll try to use a sed replacement to change port in memory or just use 3000 if not occupied.
# But 3000 might be occupied by Nginx.
# Let's Assume 3000 is occupied.

# I will update main.py to read PORT env var.

export GATEWAY_PORT=$GATEWAY_PORT
export A2R_RUN_ID="test-t0411"

# Temporary modification to main.py to support PORT env var
# Actually I'll just write a wrapper or use uvicorn CLI if I can.
# But main.py creates `app`.
# I can run `uvicorn services.gateway.src.main:app --port $GATEWAY_PORT`?
# Need to set PYTHONPATH.

export PYTHONPATH=$REPO_ROOT
$VENV_PYTHON -m uvicorn services.gateway.src.main:app --host 127.0.0.1 --port $GATEWAY_PORT > gateway_t0411.log 2>&1 &
echo $! > $PID_FILE

sleep 5

# Check if running
if ! ps -p $(cat $PID_FILE) > /dev/null; then
    echo "FAIL: Gateway failed to start."
    cat gateway_t0411.log
    exit 1
fi

FAILURES=0

# 1. Test Valid Route (should 200)
echo "1. Testing valid route /api..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$GATEWAY_PORT/api)
if [ "$HTTP_CODE" -eq 200 ]; then
    echo "PASS: Valid route allowed."
else
    echo "FAIL: Valid route rejected (Code: $HTTP_CODE)."
    FAILURES=$((FAILURES + 1))
fi

# 2. Test Raw URL in Path (simulating proxy attempt)
echo "2. Testing raw URL in path..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$GATEWAY_PORT/api/http://malicious.com")
if [ "$HTTP_CODE" -eq 403 ]; then
    echo "PASS: Raw URL rejected."
else
    echo "FAIL: Raw URL allowed (Code: $HTTP_CODE)."
    FAILURES=$((FAILURES + 1))
fi

# 3. Test Unknown Route
echo "3. Testing unknown route /unknown..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$GATEWAY_PORT/unknown-path)
if [ "$HTTP_CODE" -eq 403 ] || [ "$HTTP_CODE" -eq 404 ]; then
    echo "PASS: Unknown route rejected."
else
    echo "FAIL: Unknown route allowed (Code: $HTTP_CODE)."
    FAILURES=$((FAILURES + 1))
fi

# Cleanup
kill $(cat $PID_FILE)
rm $PID_FILE
rm gateway_t0411.log
mv infra/gateway/gateway_registry.json.bak infra/gateway/gateway_registry.json

if [ $FAILURES -eq 0 ]; then
    echo "--- [T0411] All Tests Passed ---"
    exit 0
else
    echo "--- [T0411] Some Tests Failed ---"
    exit 1
fi
