#!/bin/bash

# Browser-only development mode for A2R
# Much faster than Electron, no disk bloat

set -e

echo "🌐 A2R Browser Development Mode"
echo "================================"
echo ""

# Check if Vite is running
if ! curl -s http://127.0.0.1:5177 > /dev/null 2>&1; then
    echo "⚠️  Vite dev server not running!"
    echo ""
    echo "Starting Vite..."
    cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell/web
    pnpm dev &
    VITE_PID=$!
    echo "   Vite PID: $VITE_PID"
    
    # Wait for Vite to be ready
    echo "   Waiting for Vite to start..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:5177 > /dev/null 2>&1; then
            echo "   ✅ Vite ready!"
            break
        fi
        sleep 1
    done
else
    echo "✅ Vite already running on http://127.0.0.1:5177"
fi

echo ""
echo "Starting Chrome with CDP..."
./chrome-dev.sh

echo ""
echo "================================================"
echo "Development server ready!"
echo ""
echo "📱 App URL:    http://127.0.0.1:5177"
echo "🔧 CDP Port:   9222"
echo "🛠️  DevTools:  http://localhost:9222/devtools/inspector.html"
echo ""
echo "Commands:"
echo "   ./cdp-helper.mjs list        # List tabs"
echo "   ./cdp-helper.mjs devtools    # Open DevTools"
echo "   ./cdp-helper.mjs reload      # Reload page"
echo "   ./cdp-helper.mjs screenshot  # Take screenshot"
echo ""
echo "Stop with: pkill -f a2r-chrome-dev"
echo "================================================"
