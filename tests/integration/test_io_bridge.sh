#!/bin/bash

# Test script for IO Bridge (stdio NDJSON-RPC)

echo "Testing IO Bridge functionality..."

# Build the project
cd /Users/macbook/Desktop/allternit-workspace/allternit
cargo build --bin gateway-stdio

if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo "Build successful!"

# Test the ping method
echo "Testing ping method..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "ping", "params": null}' | timeout 10s ./target/debug/gateway-stdio &
PID=$!
sleep 2
kill $PID 2>/dev/null || true

# Test the echo method
echo "Testing echo method..."
echo '{"jsonrpc": "2.0", "id": 2, "method": "echo", "params": {"message": "Hello, IO Bridge!"}}' | timeout 10s ./target/debug/gateway-stdio &
PID=$!
sleep 2
kill $PID 2>/dev/null || true

# Test the health method
echo "Testing health method..."
echo '{"jsonrpc": "2.0", "id": 3, "method": "health", "params": null}' | timeout 10s ./target/debug/gateway-stdio &
PID=$!
sleep 2
kill $PID 2>/dev/null || true

# Test an unknown method
echo "Testing unknown method..."
echo '{"jsonrpc": "2.0", "id": 4, "method": "unknown", "params": null}' | timeout 10s ./target/debug/gateway-stdio &
PID=$!
sleep 2
kill $PID 2>/dev/null || true

echo "All tests completed!"