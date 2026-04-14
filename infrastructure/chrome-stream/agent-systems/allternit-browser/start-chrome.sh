#!/bin/bash
# =============================================================================
# A2R Chrome Launcher - Real Google Chrome with CDP
# =============================================================================
# Launches real Google Chrome with remote debugging enabled.
# The A2R platform can connect via CDP (Chrome DevTools Protocol) to control it.
# =============================================================================

set -e

CHROME_PORT=${CHROME_CDP_PORT:-9222}
USER_DATA_DIR="${CHROME_USER_DATA:-$HOME/.a2r/chrome-profile}"
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Create user data directory
mkdir -p "$USER_DATA_DIR"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║           A2R Chrome Launcher                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Chrome: $CHROME_PATH"
echo "🔌 CDP Port: $CHROME_PORT"
echo "📁 Profile: $USER_DATA_DIR"
echo ""
echo "Starting Chrome with remote debugging..."
echo ""

# Kill any existing Chrome with this CDP port
pkill -f "remote-debugging-port=$CHROME_PORT" 2>/dev/null || true
sleep 1

# Launch Chrome with CDP enabled
"$CHROME_PATH" \
  --remote-debugging-port=$CHROME_PORT \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-background-networking \
  --disable-features=TranslateUI \
  --disable-ipc-flooding-protection \
  --disable-client-side-phishing-detection \
  --disable-default-apps \
  --disable-hang-monitor \
  --disable-prompt-on-repost \
  --disable-sync \
  --metrics-recording-only \
  --safebrowsing-disable-auto-update \
  --password-store=basic \
  --use-mock-keychain \
  about:blank &

CHROME_PID=$!
echo "✓ Chrome launched (PID: $CHROME_PID)"
echo ""
echo "CDP Endpoint: http://127.0.0.1:$CHROME_PORT"
echo "Debug URL: chrome://inspect/#devices"
echo ""
echo "To connect via Playwright:"
echo "  const browser = await chromium.connectOverCDP('http://127.0.0.1:$CHROME_PORT')"
echo ""
echo "Press Ctrl+C to stop Chrome"
echo ""

# Wait for Chrome to be ready
sleep 3

# Check if Chrome is running
if curl -s "http://127.0.0.1:$CHROME_PORT/json/version" > /dev/null 2>&1; then
  echo "✓ Chrome CDP is ready"
  curl -s "http://127.0.0.1:$CHROME_PORT/json/version" | python3 -m json.tool 2>/dev/null || true
else
  echo "⚠ Chrome CDP not responding yet..."
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Chrome is ready for A2R platform integration"
echo "════════════════════════════════════════════════════════════"

# Keep running
wait $CHROME_PID
