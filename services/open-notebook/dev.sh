#!/bin/bash
# Start the Open Notebook research backend (SurrealDB + FastAPI) directly from
# this repo checkout — no vendoring, no Electron bridge required. This is what
# any local dev environment (web or desktop) should call to bring Research up.
#
# Idempotent: if either service is already listening on its port, it's left
# alone rather than double-spawned.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$HOME/.allternit/services/open-notebook"
SURREAL_PORT="${SURREAL_PORT:-9800}"
ON_PORT="${ON_PORT:-5055}"

mkdir -p "$DATA_DIR/surreal_data" "$DATA_DIR/data"

port_open() {
  curl -s -m 2 -o /dev/null "http://127.0.0.1:$1/health" 2>/dev/null
}

# ── SurrealDB ────────────────────────────────────────────────────────────────
if port_open "$SURREAL_PORT"; then
  echo "[dev] SurrealDB already running on $SURREAL_PORT"
else
  SURREAL_BIN="$(command -v surreal || true)"
  if [ -z "$SURREAL_BIN" ] && [ -x "$HOME/.allternit/bin/surreal" ]; then
    SURREAL_BIN="$HOME/.allternit/bin/surreal"
  fi
  if [ -z "$SURREAL_BIN" ]; then
    echo "[dev] SurrealDB not found. Install it (brew install surrealdb/tap/surreal) or run ./bootstrap.sh first."
    exit 1
  fi

  echo "[dev] Starting SurrealDB on $SURREAL_PORT ($SURREAL_BIN)..."
  nohup "$SURREAL_BIN" start \
    --log warn \
    --user root --pass root \
    --bind "127.0.0.1:$SURREAL_PORT" \
    "rocksdb:$DATA_DIR/surreal_data/db.db" \
    > "$DATA_DIR/surreal.log" 2>&1 &
  disown

  for _ in $(seq 1 30); do
    port_open "$SURREAL_PORT" && break
    sleep 1
  done
  port_open "$SURREAL_PORT" || { echo "[dev] SurrealDB failed to start — see $DATA_DIR/surreal.log"; exit 1; }
  echo "[dev] SurrealDB ready"
fi

# ── Open Notebook FastAPI ────────────────────────────────────────────────────
if port_open "$ON_PORT"; then
  echo "[dev] Open Notebook backend already running on $ON_PORT"
  exit 0
fi

VENV_UVICORN="$SCRIPT_DIR/.venv/bin/uvicorn"
if [ ! -x "$VENV_UVICORN" ]; then
  echo "[dev] Repo venv missing at $SCRIPT_DIR/.venv — run: uv sync (or python3 -m venv .venv && .venv/bin/pip install -e .) inside services/open-notebook first."
  exit 1
fi

echo "[dev] Starting Open Notebook backend on $ON_PORT..."
(
  cd "$SCRIPT_DIR/src"
  SURREAL_URL="ws://127.0.0.1:$SURREAL_PORT/rpc" \
  SURREAL_USER="root" \
  SURREAL_PASSWORD="root" \
  SURREAL_NAMESPACE="open_notebook" \
  SURREAL_DATABASE="open_notebook" \
  OPEN_NOTEBOOK_ENCRYPTION_KEY="${OPEN_NOTEBOOK_ENCRYPTION_KEY:-allternit-default-key-change-me}" \
  nohup "$VENV_UVICORN" main:app --host 127.0.0.1 --port "$ON_PORT" \
    > "$DATA_DIR/backend.log" 2>&1 &
  disown
)

for _ in $(seq 1 30); do
  port_open "$ON_PORT" && break
  sleep 1
done
port_open "$ON_PORT" || { echo "[dev] Open Notebook backend failed to start — see $DATA_DIR/backend.log"; exit 1; }
echo "[dev] Open Notebook backend ready on http://127.0.0.1:$ON_PORT"
