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

# Inject the token into the plist so launchd loads it securely.
/usr/libexec/PlistBuddy -c "Delete :EnvironmentVariables:TART_HOST_TOKEN" "$PLIST_SRC" >/dev/null 2>&1 || true
/usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:TART_HOST_TOKEN string $TART_HOST_TOKEN" "$PLIST_SRC"

# Install and load the launchd agent.
cp "$PLIST_SRC" "$PLIST_DST"
launchctl bootout gui/"$(id -u)"/com.allternit.tart-host >/dev/null 2>&1 || true
sleep 1
launchctl bootstrap gui/"$(id -u)" "$PLIST_DST"
launchctl enable gui/"$(id -u)"/com.allternit.tart-host
launchctl kickstart -k gui/"$(id -u)"/com.allternit.tart-host 2>/dev/null || true

# Verify health.
echo "Checking Tart host health..."
sleep 2
if curl -fsS "http://100.88.98.69:8020/health" >/dev/null 2>&1; then
    echo "Tart host is healthy on http://100.88.98.69:8020"
else
    echo "WARNING: Tart host health check failed; check $LOG_DIR/tart-host.log" >&2
    exit 1
fi

echo ""
echo "Deploy complete. Add this token to the VPS environment:"
echo "  TART_HOST_URLS=http://100.88.98.69:8020"
echo "  TART_HOST_TOKEN=$TART_HOST_TOKEN"
echo ""
echo "Then restart the VPS allternit-api service."
