#!/usr/bin/env bash
# Start the open-connector sidecar (services/open-connector) for local dev.
# Idempotent: if it is already healthy on its port, it is left alone.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONNECTORS_DIR="${ROOT_DIR}/services/open-connector"

SIDECAR_PORT="${ALLTERNIT_CONNECTOR_SIDECAR_PORT:-8014}"
HEALTH_URL="http://127.0.0.1:${SIDECAR_PORT}/health"
ENV_FILE="${ALLTERNIT_CONNECTOR_SIDECAR_ENV_FILE:-/tmp/allternit-connector-sidecar.env}"
DATA_DIR="${OOMOL_CONNECT_DATA_DIR:-${HOME}/.allternit/services/connector-sidecar-data}"
LOG_FILE="${ALLTERNIT_CONNECTOR_SIDECAR_LOG_FILE:-/tmp/allternit-connector-sidecar.log}"
PID_FILE="/tmp/allternit-connector-sidecar.pid"

if curl -s -m 2 "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "[connector-sidecar] Already running on :${SIDECAR_PORT}"
  # If an env file exists from a previous start, source it so callers get the same tokens.
  if [ -f "$ENV_FILE" ]; then
    echo "[connector-sidecar] Tokens: $ENV_FILE"
  fi
  exit 0
fi

if ! [ -d "$CONNECTORS_DIR" ]; then
  echo "[connector-sidecar] services/open-connector not found at $CONNECTORS_DIR"
  exit 1
fi

if ! [ -f "$CONNECTORS_DIR/src/server/index.ts" ]; then
  echo "[connector-sidecar] open-connector entry not found: $CONNECTORS_DIR/src/server/index.ts"
  exit 1
fi

mkdir -p "$DATA_DIR"

# Shared secrets between allternit-api and the sidecar.
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
ADMIN_TOKEN="${ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN:-$(openssl rand -hex 24)}"
RUNTIME_TOKEN="${ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN:-$(openssl rand -hex 24)}"

cat > "$ENV_FILE" <<EOF
ALLTERNIT_CONNECTOR_SIDECAR_URL=http://127.0.0.1:${SIDECAR_PORT}
ALLTERNIT_CONNECTOR_SIDECAR_ADMIN_TOKEN=${ADMIN_TOKEN}
ALLTERNIT_CONNECTOR_SIDECAR_RUNTIME_TOKEN=${RUNTIME_TOKEN}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

echo "[connector-sidecar] Starting open-connector on :${SIDECAR_PORT}"
echo "[connector-sidecar] Data: $DATA_DIR"
echo "[connector-sidecar] Log:   $LOG_FILE"
echo "[connector-sidecar] Env:   $ENV_FILE"

# Make sure generated catalog/registry is up to date before starting the server.
echo "[connector-sidecar] Ensuring generated catalog/registry..."
(cd "$CONNECTORS_DIR" && node scripts/ensure-generated.ts) >> "$LOG_FILE" 2>&1

# Start the sidecar in the background; it only binds to 127.0.0.1.
(
  cd "$CONNECTORS_DIR"
  PORT="$SIDECAR_PORT" \
  HOST='127.0.0.1' \
  OOMOL_CONNECT_ORIGIN="http://127.0.0.1:8013" \
  OOMOL_CONNECT_DATA_DIR="$DATA_DIR" \
  OOMOL_CONNECT_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  OOMOL_CONNECT_ADMIN_TOKEN="$ADMIN_TOKEN" \
  OOMOL_CONNECT_RUNTIME_TOKEN="$RUNTIME_TOKEN" \
    nohup node src/server/index.ts >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
)

# Wait for health.
for _ in $(seq 1 60); do
  if curl -s -m 2 "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "[connector-sidecar] Ready at ${HEALTH_URL}"
    echo "[connector-sidecar] PID: $(cat "$PID_FILE")"
    exit 0
  fi
  sleep 1
done

echo "[connector-sidecar] Sidecar did not become healthy — see $LOG_FILE"
tail -40 "$LOG_FILE"
exit 1
