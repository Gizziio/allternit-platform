#!/usr/bin/env bash
# Start allternit-api (cmd/allternit-api) in dev mode with auth bypass.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARY="${ROOT_DIR}/../../target/debug/allternit-api"
LOG_FILE="/tmp/allternit-api.log"

if ! [ -f "$BINARY" ]; then
    echo "[start-api] Binary not found at $BINARY"
    echo "[start-api] Run 'cargo build --bin allternit-api' from the workspace root first."
    exit 1
fi

# Kill any existing instance on port 8013
if lsof -ti:8013 > /dev/null 2>&1; then
    echo "[start-api] Stopping existing process on port 8013..."
    lsof -ti:8013 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "[start-api] Starting allternit-api on :8013 (dev mode, auth bypass enabled)"
echo "[start-api] Log: $LOG_FILE"

ALLTERNIT_DEV_AUTH_BYPASS=1 \
    "$BINARY" > "$LOG_FILE" 2>&1 &

PID=$!
echo "[start-api] PID: $PID"
echo "$PID" > /tmp/allternit-api.pid

# Wait briefly to check it didn't immediately exit
sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
    echo "[start-api] Process exited immediately — check $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
fi

echo "[start-api] Running. 'tail -f $LOG_FILE' to watch."
