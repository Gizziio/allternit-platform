#!/bin/bash
# Allternit Full Integration Test
# Starts all components and tests their connections

set -e

echo "======================================"
echo "Allternit Full Integration Test"
echo "======================================"
echo ""
echo "This script will:"
echo "1. Start Cloud Backend"
echo "2. Start Desktop App (with Cowork mode)"
echo "3. Test WebSocket connections"
echo "4. Verify all ports are listening"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.test-logs"
mkdir -p "$LOG_DIR"

# Function to check if port is listening
check_port() {
    local port=$1
    local name=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is listening on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT listening on port $port"
        return 1
    fi
}

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    if [ -n "$CLOUD_PID" ]; then
        kill $CLOUD_PID 2>/dev/null || true
    fi
    if [ -n "$DESKTOP_PID" ]; then
        kill $DESKTOP_PID 2>/dev/null || true
    fi
    echo "Done"
}
trap cleanup EXIT

# ============================================================================
# STEP 1: Cloud Backend
# ============================================================================
echo ""
echo "[Step 1/4] Starting Cloud Backend..."
echo "======================================"

cd "$ROOT_DIR/7-apps/cloud-backend"

if ! check_port 8080 "Cloud Backend"; then
    echo "Starting Cloud Backend..."
    npm start > "$LOG_DIR/cloud-backend.log" 2>&1 &
    CLOUD_PID=$!
    
    # Wait for it to start
    for i in {1..30}; do
        if check_port 8080 "Cloud Backend"; then
            break
        fi
        sleep 1
    done
    
    if ! check_port 8080 "Cloud Backend"; then
        echo -e "${RED}Failed to start Cloud Backend${NC}"
        cat "$LOG_DIR/cloud-backend.log"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} Cloud Backend already running"
fi

# Test health endpoint
echo "Testing Cloud Backend health..."
HEALTH=$(curl -s http://localhost:8080/health)
echo "Response: $HEALTH"

# ============================================================================
# STEP 2: Desktop App
# ============================================================================
echo ""
echo "[Step 2/4] Starting Desktop App..."
echo "======================================"

cd "$ROOT_DIR/7-apps/shell/desktop"

# Check if already running
if check_port 3010 "Desktop Cowork" && check_port 3011 "Desktop Native Messaging"; then
    echo -e "${YELLOW}⚠${NC} Desktop already running"
else
    echo "Starting Desktop App (this may take a moment)..."
    
    # Build if needed
    if [ ! -d "dist/main" ]; then
        echo "Building Desktop..."
        npm run build:electron > "$LOG_DIR/desktop-build.log" 2>&1
    fi
    
    # Start in background
    npm run dev > "$LOG_DIR/desktop.log" 2>&1 &
    DESKTOP_PID=$!
    
    # Wait for ports
    echo "Waiting for Desktop to start..."
    for i in {1..60}; do
        if check_port 3010 "Desktop Cowork" && check_port 3011 "Desktop Native Messaging"; then
            break
        fi
        sleep 1
    done
    
    if ! check_port 3010 "Desktop Cowork"; then
        echo -e "${RED}Failed to start Desktop Cowork mode${NC}"
        cat "$LOG_DIR/desktop.log"
        exit 1
    fi
fi

# ============================================================================
# STEP 3: WebSocket Connection Tests
# ============================================================================
echo ""
echo "[Step 3/4] Testing WebSocket Connections..."
echo "======================================"

# Test Cloud Backend WebSocket
echo "Testing Cloud Backend WebSocket..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/ws/extension');

ws.on('open', () => {
    console.log('Connected to Cloud Backend');
    ws.send(JSON.stringify({
        id: 'test-1',
        type: 'auth',
        payload: { token: 'test-token', clientType: 'browser-extension', version: '1.0.0' },
        timestamp: Date.now()
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Received:', msg.type);
    if (msg.type === 'auth:response') {
        if (msg.payload.success) {
            console.log('✓ Authentication successful');
            ws.close();
            process.exit(0);
        } else {
            console.log('✗ Authentication failed:', msg.payload.error);
            ws.close();
            process.exit(1);
        }
    }
});

ws.on('error', (err) => {
    console.log('✗ WebSocket error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('✗ Timeout');
    process.exit(1);
}, 5000);
" || echo -e "${RED}Cloud Backend WebSocket test failed${NC}"

# Test Desktop Cowork WebSocket
echo ""
echo "Testing Desktop Cowork WebSocket..."
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3010');

ws.on('open', () => {
    console.log('Connected to Desktop Cowork');
    ws.send(JSON.stringify({
        id: 'test-2',
        type: 'ping',
        timestamp: Date.now()
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    console.log('Received:', msg.type);
    if (msg.type === 'connected' || msg.type === 'pong') {
        console.log('✓ Desktop Cowork responding');
        ws.close();
        process.exit(0);
    }
});

ws.on('error', (err) => {
    console.log('✗ WebSocket error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('✗ Timeout');
    process.exit(1);
}, 5000);
" || echo -e "${RED}Desktop Cowork WebSocket test failed${NC}"

# ============================================================================
# STEP 4: Summary
# ============================================================================
echo ""
echo "[Step 4/4] Integration Test Summary"
echo "======================================"
echo ""

echo "Services Status:"
check_port 8080 "Cloud Backend"
check_port 3010 "Desktop Cowork"
check_port 3011 "Desktop Native Messaging"
check_port 3000 "Desktop Sidecar API"

echo ""
echo "Log Files:"
echo "  Cloud Backend: $LOG_DIR/cloud-backend.log"
echo "  Desktop:       $LOG_DIR/desktop.log"
echo ""

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Integration Test Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Load extension in Chrome:"
echo "   chrome://extensions → Developer mode → Load unpacked"
echo "   Select: 7-apps/chrome-extension/dist/"
echo ""
echo "2. Run Thin Client:"
echo "   open '7-apps/thin-client/release/Gizzi Thin Client-0.1.0-arm64.app'"
echo ""
echo "3. Test connection modes:"
echo "   - Cloud mode: Connects to localhost:8080"
echo "   - Cowork mode: Connects to localhost:3010"
echo ""

# Keep script running if --keep flag is passed
if [ "$1" == "--keep" ]; then
    echo "Keeping services running (press Ctrl+C to stop)..."
    wait
fi
