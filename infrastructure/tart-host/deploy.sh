#!/bin/bash
# Deploy the Allternit Tart host wrapper on a macOS Apple-Silicon machine.
# Run locally on the Mac that will host macOS desktops.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TART_HOST_BIN="/usr/local/bin/allternit-tart-host"
PLIST_SRC="${REPO_ROOT}/infrastructure/tart-host/com.allternit.tart-host.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/com.allternit.tart-host.plist"
ENV_FILE="${HOME}/.allternit/tart-host.env"
LOG_DIR="${HOME}/Library/Logs/allternit"
TART_BIN="${TART_BIN:-/opt/homebrew/bin/tart}"

if ! command -v "$TART_BIN" >/dev/null 2>&1; then
    echo "ERROR: Tart not found at $TART_BIN" >&2
    echo "Install with: brew install cirruslabs/cli/tart" >&2
    exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
    echo "WARNING: Tart Apple Virtualization requires Apple Silicon (arm64)." >&2
fi

# Pick the host's Tailscale IPv4 by default so the VPS can reach the wrapper
# over the mesh. Override with TART_HOST_IP=... to use a different interface.
if [[ -n "${TART_HOST_IP:-}" ]]; then
    HOST_IP="${TART_HOST_IP}"
elif command -v tailscale >/dev/null 2>&1 && HOST_IP=$(tailscale ip -4 2>/dev/null); then
    :
else
    echo "ERROR: could not determine Tailscale IPv4; set TART_HOST_IP" >&2
    exit 1
fi
TART_HOST_BIND="${HOST_IP}:8020"

# Ensure log directory exists.
mkdir -p "$LOG_DIR"

# Build the wrapper binary.
echo "Building allternit-tart-host..."
cd "$REPO_ROOT"
cargo build --release -p allternit-computer-cloud --bin tart-host

# Install binary.
echo "Installing $TART_HOST_BIN..."
sudo cp "${REPO_ROOT}/target/release/tart-host" "$TART_HOST_BIN"
sudo chmod +x "$TART_HOST_BIN"

# Generate or reuse auth token.
mkdir -p "$(dirname "$ENV_FILE")"
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi
if [[ -z "${TART_HOST_TOKEN:-}" ]]; then
    TART_HOST_TOKEN="$(openssl rand -hex 32)"
    echo "TART_HOST_TOKEN=$TART_HOST_TOKEN" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "Generated new TART_HOST_TOKEN in $ENV_FILE"
else
    echo "Reusing existing TART_HOST_TOKEN from $ENV_FILE"
fi

# Build the launchd plist from the template, substituting runtime values.
PLIST_TMP="$(mktemp)"
trap 'rm -f "$PLIST_TMP"' EXIT
sed \
    -e "s|__TART_HOST_BIND__|${TART_HOST_BIND}|g" \
    -e "s|__TART_HOST_TOKEN__|${TART_HOST_TOKEN}|g" \
    -e "s|__HOME__|${HOME}|g" \
    "$PLIST_SRC" > "$PLIST_TMP"
cp "$PLIST_TMP" "$PLIST_DST"

# Install and load the launchd agent.
launchctl bootout gui/"$(id -u)"/com.allternit.tart-host >/dev/null 2>&1 || true
sleep 1
launchctl bootstrap gui/"$(id -u)" "$PLIST_DST"
launchctl enable gui/"$(id -u)"/com.allternit.tart-host
launchctl kickstart -k gui/"$(id -u)"/com.allternit.tart-host 2>/dev/null || true

# Verify health.
echo "Checking Tart host health on ${TART_HOST_BIND}..."
sleep 2
if curl -fsS "http://${TART_HOST_BIND}/health" >/dev/null 2>&1; then
    echo "Tart host is healthy on http://${TART_HOST_BIND}"
else
    echo "WARNING: Tart host health check failed; check $LOG_DIR/tart-host.log" >&2
    exit 1
fi

echo ""
echo "Deploy complete. Add this token to the VPS environment:"
echo "  TART_HOST_URLS=http://${HOST_IP}:8020"
echo "  TART_HOST_TOKEN=$TART_HOST_TOKEN"
echo ""
echo "Then restart the VPS allternit-api service."
