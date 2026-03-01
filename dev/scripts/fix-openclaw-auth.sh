#!/bin/bash

# Fix OpenClaw authentication for Shell UI integration
# This script updates the OpenClaw config to allow insecure auth for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Generate a secure token
TOKEN=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | head -c 64)

# Save token to env file
echo "OPENCLAW_GATEWAY_TOKEN=${TOKEN}" > "$PROJECT_ROOT/.openclaw.env"
echo "OPENCLAW_PORT=18789" >> "$PROJECT_ROOT/.openclaw.env"

# Update OpenClaw config
OPENCLAW_CONFIG_DIR="${HOME}/.openclaw"
mkdir -p "$OPENCLAW_CONFIG_DIR"

# Read existing config or create new one
CONFIG_FILE="$OPENCLAW_CONFIG_DIR/openclaw.json"
if [ -f "$CONFIG_FILE" ]; then
    print_status "Updating existing OpenClaw config..."
    # Backup
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%s)" 2>/dev/null || true
else
    print_status "Creating new OpenClaw config..."
    echo '{}' > "$CONFIG_FILE"
fi

# Use Node.js to merge config (more reliable than jq)
node -e "
const fs = require('fs');
const path = '$CONFIG_FILE';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

// Ensure gateway section exists
config.gateway = config.gateway || {};
config.gateway.port = 18789;

// Set auth
config.gateway.auth = config.gateway.auth || {};
config.gateway.auth.token = '$TOKEN';

// Enable insecure auth for Control UI (local development only)
config.gateway.controlUi = config.gateway.controlUi || {};
config.gateway.controlUi.allowInsecureAuth = true;

fs.writeFileSync(path, JSON.stringify(config, null, 2));
console.log('Config updated successfully');
"

print_success "OpenClaw configuration updated"
print_status "Gateway token: ${TOKEN:0:16}..."
print_status "Config file: $CONFIG_FILE"
print_status "Env file: $PROJECT_ROOT/.openclaw.env"

# Check if OpenClaw is running
if lsof -ti :18789 > /dev/null 2>&1; then
    print_warning "OpenClaw is currently running. You need to restart it for changes to take effect."
    echo ""
    echo -e "${YELLOW}To restart OpenClaw:${NC}"
    echo "  ./scripts/start-all.sh restart"
    echo ""
    echo -e "${YELLOW}Or stop and start manually:${NC}"
    echo "  openclaw gateway stop"
    echo "  openclaw gateway --port 18789"
else
    print_success "OpenClaw is not running. Start it with:"
    echo "  ./scripts/start-all.sh start"
fi

echo ""
print_success "Configuration complete!"
