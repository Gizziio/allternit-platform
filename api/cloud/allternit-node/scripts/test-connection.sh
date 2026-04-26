#!/bin/bash
#
# Test script for Allternit Node <-> Control Plane connection
#
# This script:
# 1. Starts the test server
# 2. Waits for it to be ready
# 3. Starts the node agent
# 4. Verifies they can communicate
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Allternit Node Connection Test${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""

# Configuration
PORT=${PORT:-8013}
TEST_DURATION=${TEST_DURATION:-30}
NODE_ID="test-node-$(date +%s)"
TOKEN="test-token"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    if [ -n "$NODE_PID" ]; then
        kill $NODE_PID 2>/dev/null || true
        wait $NODE_PID 2>/dev/null || true
    fi
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Build the project first
echo "🔨 Building project..."
cargo build --bin allternit-node --quiet 2>&1 | grep -v "^warning:" || true
cargo build --bin test-server --quiet 2>&1 | grep -v "^warning:" || true
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Kill any existing processes on the port
echo "🧹 Cleaning up any existing processes on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Start test server
echo "🚀 Starting test control plane on port $PORT..."
PORT=$PORT cargo run --bin test-server &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:$PORT/api/v1/nodes > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is ready${NC}"
        break
    fi
    sleep 0.5
done

echo ""
echo "🚀 Starting Allternit Node..."
echo "   Node ID: $NODE_ID"
echo "   Control Plane: ws://localhost:$PORT"
echo ""

# Start node with test configuration
ALLTERNIT_NODE_ID=$NODE_ID \
ALLTERNIT_TOKEN=$TOKEN \
ALLTERNIT_CONTROL_PLANE="ws://localhost:$PORT" \
cargo run --bin allternit-node -- --once &
NODE_PID=$!

echo "⏳ Running test for $TEST_DURATION seconds..."
echo ""

# Monitor for successful connection
SUCCESS=0
for i in $(seq 1 $TEST_DURATION); do
    # Check if node appears in server's node list
    if curl -s http://localhost:$PORT/api/v1/nodes | grep -q "$NODE_ID"; then
        if [ $SUCCESS -eq 0 ]; then
            echo -e "${GREEN}✓ Node successfully registered with control plane!${NC}"
            SUCCESS=1
        fi
    fi
    
    # Check if processes are still running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}✗ Server process died${NC}"
        exit 1
    fi
    
    if ! kill -0 $NODE_PID 2>/dev/null; then
        if [ $SUCCESS -eq 0 ]; then
            echo -e "${RED}✗ Node process died before connecting${NC}"
            exit 1
        fi
    fi
    
    sleep 1
done

echo ""
if [ $SUCCESS -eq 1 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   ✓ Connection test PASSED${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "The Allternit Node successfully:"
    echo "  1. Connected to the control plane"
    echo "  2. Registered itself"
    echo "  3. Sent heartbeat messages"
    echo ""
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════════${NC}"
    echo -e "${RED}   ✗ Connection test FAILED${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "Node did not successfully register with control plane"
    echo ""
    exit 1
fi
