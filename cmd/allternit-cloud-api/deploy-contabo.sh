#!/usr/bin/env bash
# Deploy allternit-cloud-api Linux binary to the Contabo control plane.
#
# Usage: ./deploy-contabo.sh <binary-path>
# Requires: CONTABO_DEPLOY_HOST, CONTABO_DEPLOY_USER, CONTABO_SSH_KEY (or ssh-agent)

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

# Swap binary and restart service
ssh $SSH_OPTS "$USER@$HOST" bash -s <<'REMOTE'
set -euo pipefail
systemctl stop allternit-cloud-api
mv /tmp/allternit-cloud-api.new /opt/allternit-cloud-api/bin/allternit-cloud-api
chmod +x /opt/allternit-cloud-api/bin/allternit-cloud-api
systemctl start allternit-cloud-api
sleep 3
systemctl status allternit-cloud-api --no-pager
REMOTE

echo "Deploy complete."
