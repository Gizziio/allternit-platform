#!/bin/bash
# Integration script to add Terminal Server support to existing start-all.sh
# Run this to patch the original start-all.sh with Terminal Server functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
START_ALL_SCRIPT="$PROJECT_ROOT/dev/scripts/start-all.sh"

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

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if original script exists
if [ ! -f "$START_ALL_SCRIPT" ]; then
    print_error "Original start-all.sh not found at: $START_ALL_SCRIPT"
    exit 1
fi

# Create backup
BACKUP_FILE="$START_ALL_SCRIPT.backup.$(date +%s)"
cp "$START_ALL_SCRIPT" "$BACKUP_FILE"
print_status "Backup created: $BACKUP_FILE"

# Check if already patched
if grep -q "TERMINAL_SERVER_PORT" "$START_ALL_SCRIPT"; then
    print_warning "start-all.sh already includes Terminal Server configuration"
    echo ""
    echo "Options:"
    echo "  1. Use existing backup: cp $BACKUP_FILE $START_ALL_SCRIPT"
    echo "  2. Use new standalone script: ./dev/scripts/start-all-with-terminal.sh"
    echo ""
    read -p "Restore from backup? (y/N): " response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        cp "$BACKUP_FILE" "$START_ALL_SCRIPT"
        print_success "Restored from backup"
    fi
    rm "$BACKUP_FILE"
    exit 0
fi

print_status "Integrating Terminal Server into start-all.sh..."

# Create the patch content
PATCH_CONTENT='
# ============================================================================
# Terminal Server Configuration (Added by integrate-terminal-server.sh)
# ============================================================================
TERMINAL_SERVER_PORT=4096
TERMINAL_SERVER_HOST=127.0.0.1
TERMINAL_SERVER_DIR="$PROJECT_ROOT/7-apps/shell/terminal"
TERMINAL_SERVER_PID_FILE="$LOG_DIR/terminal-server.pid"

# ============================================================================
# Terminal Server Functions
# ============================================================================

start_terminal_server() {
    print_status "Starting Terminal Server (AI Model Service)..."

    if [ ! -d "$TERMINAL_SERVER_DIR" ]; then
        print_error "Terminal server directory not found: $TERMINAL_SERVER_DIR"
        return 1
    fi

    if ! command -v bun &> /dev/null; then
        print_error "bun is not installed. Install with: curl -fsSL https://bun.sh/install | bash"
        return 1
    fi

    if [ ! -d "$TERMINAL_SERVER_DIR/node_modules" ]; then
        print_warning "Installing Terminal Server dependencies..."
        (cd "$TERMINAL_SERVER_DIR" && bun install)
    fi

    export A2R_DATA_DIR="${A2R_DATA_DIR:-$PROJECT_ROOT/.a2r}"
    
    (
        cd "$TERMINAL_SERVER_DIR"
        bun run src/index.ts serve \
            --port $TERMINAL_SERVER_PORT \
            --hostname $TERMINAL_SERVER_HOST \
            > "$LOG_DIR/terminal-server.log" 2>&1
    ) &

    TERMINAL_PID=$!
    echo $TERMINAL_PID > "$TERMINAL_SERVER_PID_FILE"

    print_status "Waiting for Terminal Server to start..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://${TERMINAL_SERVER_HOST}:${TERMINAL_SERVER_PORT}/doc" > /dev/null 2>&1; then
            print_success "Terminal Server started on http://${TERMINAL_SERVER_HOST}:${TERMINAL_SERVER_PORT}"
            echo "TERMINAL_SERVER_URL=http://${TERMINAL_SERVER_HOST}:${TERMINAL_SERVER_PORT}" > "$PROJECT_ROOT/.terminal-server.env"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "Terminal Server failed to start within ${max_attempts}s"
    return 1
}

stop_terminal_server() {
    if [ -f "$TERMINAL_SERVER_PID_FILE" ]; then
        pid=$(cat "$TERMINAL_SERVER_PID_FILE")
        kill -9 "$pid" 2>/dev/null || true
        rm -f "$TERMINAL_SERVER_PID_FILE"
        rm -f "$PROJECT_ROOT/.terminal-server.env"
    fi
    lsof -ti :${TERMINAL_SERVER_PORT} | xargs kill -9 2>/dev/null || true
}
'

# Read the original script
ORIGINAL_CONTENT=$(cat "$START_ALL_SCRIPT")

# Find the line with "VOICE_SERVICE_PORT=8001" and insert before it
if echo "$ORIGINAL_CONTENT" | grep -q "VOICE_SERVICE_PORT=8001"; then
    # Add configuration after the existing port configurations
    MODIFIED_CONTENT=$(echo "$ORIGINAL_CONTENT" | sed "/^VOICE_SERVICE_PORT=8001/i\\
$PATCH_CONTENT")
    
    # Add terminal server cleanup to cleanup function
    MODIFIED_CONTENT=$(echo "$MODIFIED_CONTENT" | sed "s/lsof -ti :\${VOICE_SERVICE_PORT}/lsof -ti :\${TERMINAL_SERVER_PORT} | xargs kill -9 2>\/dev\/null || true\n    lsof -ti :\${VOICE_SERVICE_PORT}/")
    
    # Add terminal server start to main function (before voice service)
    MODIFIED_CONTENT=$(echo "$MODIFIED_CONTENT" | sed "s/start_voice_service/start_terminal_server || exit 1\n    start_voice_service/")
    
    # Add terminal server stop to stop_services function
    MODIFIED_CONTENT=$(echo "$MODIFIED_CONTENT" | sed "s/print_status \"Stopping all A2rchitech services...\"/print_status \"Stopping all A2rchitech services...\"\n    stop_terminal_server/")
    
    # Add terminal server to status check
    MODIFIED_CONTENT=$(echo "$MODIFIED_CONTENT" | sed "s/echo -e \"\${CYAN}Service Status:\${NC}\"/echo -e \"\${CYAN}Service Status:\${NC}\"\n    if curl -s \"http:\/\/\${TERMINAL_SERVER_HOST}:\${TERMINAL_SERVER_PORT}\/doc\" > \/dev\/null 2>\&1; then\n        echo -e \"  \${GREEN}\u2713\${NC} Terminal Server (port \${TERMINAL_SERVER_PORT})\"\n    else\n        echo -e \"  \${RED}\u2717\${NC} Terminal Server (port \${TERMINAL_SERVER_PORT})\"\n    fi/")
    
    # Write modified content
    echo "$MODIFIED_CONTENT" > "$START_ALL_SCRIPT"
    chmod +x "$START_ALL_SCRIPT"
    
    print_success "Terminal Server integrated into start-all.sh"
    print_status "Backup saved to: $BACKUP_FILE"
    
    echo ""
    echo "Next steps:"
    echo "  1. Configure AI provider API keys in your environment"
    echo "  2. Run: ./dev/scripts/start-all.sh start"
    echo "  3. Access Terminal Server at: http://127.0.0.1:4096"
    echo ""
    
else
    print_error "Could not find insertion point in start-all.sh"
    print_status "Using standalone script instead: ./dev/scripts/start-all-with-terminal.sh"
    rm "$BACKUP_FILE"
    exit 1
fi
