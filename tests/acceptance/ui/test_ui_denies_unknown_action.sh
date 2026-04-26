#!/bin/bash
set -e

ROOT="$(pwd)"
PORT=3009 # Use a different port for testing

echo "Running AT-UI-0002: UI denies unknown action"

# Start gateway service in background
Allternit_RUN_ID="test-run-ui" python3 services/gateway/src/main.py serve > /tmp/gateway_test.log 2>&1 &
PID=$!

# Ensure cleanup on exit
trap "kill $PID || true" EXIT

# Wait for service to be ready
timeout=10
while ! curl -s http://localhost:3000/health > /dev/null; do
    sleep 1
    timeout=$((timeout-1))
    if [ $timeout -le 0 ]; then
        echo "FAIL: Gateway service failed to start"
        cat /tmp/gateway_test.log
        exit 1
    fi
done

# Send unknown action
response=$(curl -s -X POST http://localhost:3000/v1/ui/execute \
  -H "Content-Type: application/json" \
  -d '{ "action_version": "v0.1", "action_id": "unknown-action", "gateway_route": "POST:/", "run_id": "test-run-ui", "wih_id": "T0804", "payload": {}, "timestamp": "2026-01-28T12:00:00Z", "source": "test", "session_id": "test-session", "user_id": "test-user" }')

if echo "$response" | grep -q "not allowed by registry"; then
    echo "Success: Unknown action denied as expected"
else
    echo "FAIL: Unknown action was not denied or returned unexpected response"
    echo "$response"
    exit 1
fi

echo "AT-UI-0002: PASSED"
