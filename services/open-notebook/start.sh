#!/bin/bash
# Start Open Notebook backend (SurrealDB + FastAPI)
# Designed to be called by Allternit's desktop shell

set -e

DATA_DIR="$HOME/.allternit/services/open-notebook"
BIN_DIR="$HOME/.allternit/bin"
SURREAL_BIN="$BIN_DIR/surreal"
VENV_DIR="$DATA_DIR/venv"
SURREAL_PORT="${SURREAL_PORT:-9800}"
ON_PORT="${ON_PORT:-5055}"
ENCRYPTION_KEY="${OPEN_NOTEBOOK_ENCRYPTION_KEY:-allternit-default-key-change-me}"

# Ensure SurrealDB is available
if [ ! -f "$SURREAL_BIN" ]; then
  echo "[start] SurrealDB not found. Run ./bootstrap.sh first."
  exit 1
fi

# ── Start SurrealDB ─────────────────────────────────────────────────────────
echo "[start] Starting SurrealDB on port $SURREAL_PORT..."
$SURREAL_BIN start \
  --log info \
  --user root --pass root \
  --bind "127.0.0.1:$SURREAL_PORT" \
  "rocksdb:$DATA_DIR/surreal_data/db.db" &
SURREAL_PID=$!

# Wait for SurrealDB to be ready
for i in {1..30}; do
  if curl -s "http://127.0.0.1:$SURREAL_PORT/health" > /dev/null 2>&1; then
    echo "[start] SurrealDB ready"
    break
  fi
  sleep 1
done

if ! kill -0 $SURREAL_PID 2>/dev/null; then
  echo "[start] SurrealDB failed to start"
  exit 1
fi

# ── Start Open Notebook FastAPI ─────────────────────────────────────────────
echo "[start] Starting Open Notebook backend on port $ON_PORT..."

export SURREAL_URL="ws://127.0.0.1:$SURREAL_PORT/rpc"
export SURREAL_USER="root"
export SURREAL_PASSWORD="root"
export SURREAL_NAMESPACE="open_notebook"
export SURREAL_DATABASE="open_notebook"
export OPEN_NOTEBOOK_ENCRYPTION_KEY="$ENCRYPTION_KEY"
export OPEN_NOTEBOOK_DATA_DIR="$DATA_DIR/data"

# If vendored Open Notebook source exists, run it
if [ -f "$DATA_DIR/src/open_notebook/main.py" ]; then
  APP_MODULE="open_notebook.main:app"
  cd "$DATA_DIR/src"
  "$VENV_DIR/bin/uvicorn" "$APP_MODULE" \
    --host 127.0.0.1 \
    --port "$ON_PORT" \
    --reload false &
  ON_PID=$!
else
  # Fallback: run the minimal bridge API until Open Notebook is vendored
  echo "[start] Open Notebook source not found. Starting minimal bridge API..."
  "$VENV_DIR/bin/python" - "$DATA_DIR" "$ON_PORT" << 'PYTHON'
import sys, os
sys.path.insert(0, os.path.join(sys.argv[1], 'src'))
from fastapi import FastAPI
app = FastAPI(title="Allternit Research Bridge")
@app.get("/health")
def health():
    return {"status": "ok", "mode": "bridge"}
PYTHON
  ON_PID=$!
fi

echo "[start] Open Notebook backend PID: $ON_PID"
echo "[start] SurrealDB PID: $SURREAL_PID"
echo "[start] API: http://127.0.0.1:$ON_PORT"

# Wait for either process to exit
wait -n $SURREAL_PID $ON_PID
EXIT_CODE=$?

# Cleanup
kill $SURREAL_PID $ON_PID 2>/dev/null || true
wait $SURREAL_PID $ON_PID 2>/dev/null || true

exit $EXIT_CODE
