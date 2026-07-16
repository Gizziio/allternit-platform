#!/usr/bin/env bash
set -euo pipefail

# Allternit Hosted Runtime entrypoint.
# 1. Starts the local Gizzi gateway on 127.0.0.1:8013.
# 2. Starts agent-daemon, which pairs with the cloud API and opens the relay.

mkdir -p /data
chmod 700 /data

export ALLTERNIT_GATEWAY_URL="${ALLTERNIT_GATEWAY_URL:-http://127.0.0.1:8013}"
export ALLTERNIT_RUNTIME_IDENTITY_PATH="${ALLTERNIT_RUNTIME_IDENTITY_PATH:-/data/runtime-identity.json}"

# TODO: replace with the real Gizzi gateway startup command once the CLI exposes
# a headless server mode. For now this placeholder keeps the container alive
# so the relay can connect.
start_gizzi_gateway() {
  echo "[hosted-runtime] Starting Gizzi gateway on ${ALLTERNIT_GATEWAY_URL}..."
  # Example: cd /app/cmd/gizzi-code && bun run start server --port 8013
  # Leaving the port open via a simple TCP listener avoids crash loops while
  # the integration is being finished.
  bun -e "
    const http = require('http');
    const server = http.createServer((req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'gizzi_gateway_not_ready' }));
    });
    server.listen(8013, '127.0.0.1', () => console.log('[gizzi-gateway] placeholder listening on 8013'));
  " &
}

start_agent_daemon() {
  echo "[hosted-runtime] Starting agent-daemon..."
  cd /app/cmd/agent-daemon
  exec bun run start
}

# Best-effort: wait for the gateway socket to accept connections.
wait_for_gateway() {
  local attempts=0
  while ! curl -fsS "${ALLTERNIT_GATEWAY_URL}/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "[hosted-runtime] Gizzi gateway did not become ready in time"
      return 1
    fi
    sleep 1
  done
  echo "[hosted-runtime] Gizzi gateway is ready"
}

start_gizzi_gateway
wait_for_gateway || true
start_agent_daemon
