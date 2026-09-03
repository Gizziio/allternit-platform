#!/usr/bin/env bash
# Deploy allternit-cloud-api Linux binary to the Contabo control plane.
#
# Usage: ./deploy-contabo.sh <binary-path>
# Env:   CONTABO_DEPLOY_HOST (default 100.108.37.126 = mail over tailnet)
#        CONTABO_DEPLOY_USER (default root)
#        CONTABO_SSH_KEY     (path to private key; empty = Tailscale SSH / ssh-agent)
#
# Post-swap health check with automatic rollback: if the new binary does not
# answer /api/v1/health, the previous binary is restored and the script exits
# non-zero, leaving the service running the old build.

set -euo pipefail

BINARY_PATH="${1:-}"
if [[ -z "$BINARY_PATH" || ! -f "$BINARY_PATH" ]]; then
    echo "Usage: $0 <binary-path>"
    exit 1
fi

HOST="${CONTABO_DEPLOY_HOST:-100.108.37.126}"
USER="${CONTABO_DEPLOY_USER:-root}"
SSH_KEY="${CONTABO_SSH_KEY:-}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

if [[ -n "$SSH_KEY" ]]; then
    SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

echo "Deploying $BINARY_PATH to $USER@$HOST..."

# Copy binary to a temp location
scp $SSH_OPTS "$BINARY_PATH" "$USER@$HOST:/tmp/allternit-cloud-api.new"

# Swap binary, restart, verify health, roll back on failure
ssh $SSH_OPTS "$USER@$HOST" bash -s <<'REMOTE'
set -euo pipefail
BIN=/opt/allternit-cloud-api/bin/allternit-cloud-api
BAK=/opt/allternit-cloud-api/bin/allternit-cloud-api.prev

if [[ -f "$BIN" ]]; then
    cp "$BIN" "$BAK"
fi

systemctl stop allternit-cloud-api
mv /tmp/allternit-cloud-api.new "$BIN"
chmod +x "$BIN"
systemctl start allternit-cloud-api

for attempt in 1 2 3 4 5; do
    sleep 2
    if curl -sf http://localhost:8082/api/v1/health > /dev/null 2>&1; then
        echo "health check OK"
        exit 0
    fi
    echo "waiting for health (attempt $attempt)..."
done

echo "HEALTH CHECK FAILED — rolling back to previous binary" >&2
systemctl stop allternit-cloud-api
if [[ -f "$BAK" ]]; then
    cp "$BAK" "$BIN"
fi
systemctl start allternit-cloud-api
sleep 3
if curl -sf http://localhost:8082/api/v1/health > /dev/null 2>&1; then
    echo "rollback restored the previous build (service healthy)"
else
    echo "rollback did not restore health — investigate manually" >&2
fi
exit 1
REMOTE

echo "Deploy complete."
