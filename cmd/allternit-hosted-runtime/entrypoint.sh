#!/usr/bin/env bash
set -euo pipefail

# Allternit Hosted Runtime entrypoint.
# 1. Starts the local Gizzi gateway on 127.0.0.1:8013.
# 2. Starts agent-daemon, which pairs with the cloud API and opens the relay.

mkdir -p /data
chmod 700 /data

export ALLTERNIT_GATEWAY_URL="${ALLTERNIT_GATEWAY_URL:-http://127.0.0.1:8013}"
export ALLTERNIT_RUNTIME_IDENTITY_PATH="${ALLTERNIT_RUNTIME_IDENTITY_PATH:-/data/runtime-identity.json}"

gateway_pid=""
daemon_pid=""

shutdown() {
  trap - TERM INT EXIT
  if [ -n "$daemon_pid" ]; then kill -TERM "$daemon_pid" 2>/dev/null || true; fi
  if [ -n "$gateway_pid" ]; then kill -TERM "$gateway_pid" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}

trap shutdown TERM INT EXIT

start_gizzi_gateway() {
  echo "[hosted-runtime] Starting Gizzi gateway on ${ALLTERNIT_GATEWAY_URL}..."
  /app/cmd/gizzi-code/dist/gizzi-code serve \
    --hostname 127.0.0.1 \
    --port "${PORT:-8013}" &
  gateway_pid=$!
}

start_agent_daemon() {
  echo "[hosted-runtime] Starting agent-daemon..."
  cd /app/cmd/agent-daemon
  bun dist/index.js &
  daemon_pid=$!
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
wait_for_gateway
start_agent_daemon

# Exit the container if either half fails. Fly's on-failure policy will
# restart the machine, while the trap always terminates the surviving child.
wait -n "$gateway_pid" "$daemon_pid"
