#!/bin/bash

# Chrome Development Launcher with CDP
# Launches Chrome in app mode with remote debugging for automation

CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
APP_URL="http://127.0.0.1:5177"
USER_DATA_DIR="$HOME/.config/allternit-chrome-dev"

echo "🚀 Launching Chrome in app mode with CDP..."
echo "   URL: $APP_URL"
echo "   CDP Port: 9222"
echo "   User Data: $USER_DATA_DIR"
echo ""

mkdir -p "$USER_DATA_DIR"

# Kill any existing Chrome with same profile
pkill -f "allternit-chrome-dev" 2>/dev/null || true

# Launch Chrome with CDP
"$CHROME_PATH" \
  --remote-debugging-port=9222 \
  --user-data-dir="$USER_DATA_DIR" \
  --app="$APP_URL" \
  --enable-logging \
  --v=1 \
  --disable-background-networking \
  --disable-background-timer-throttling \
  --disable-client-side-phishing-detection \
  --disable-default-apps \
  --disable-extensions \
  --disable-hang-monitor \
  --disable-popup-blocking \
  --disable-prompt-on-repost \
  --disable-sync \
  --metrics-recording-only \
  --no-first-run \
  --password-store=basic \
  --use-mock-keychain \
  --force-device-scale-factor=1.0 \
  --window-size=1400,900 \
  --window-position=100,50 \
  --start-maximized \
  2>&1 &

CHROME_PID=$!
echo "Chrome PID: $CHROME_PID"
echo ""
echo "✅ Chrome launched!"
echo "   DevTools: http://localhost:9222/devtools/inspector.html"
echo "   JSON: http://localhost:9222/json/list"
echo ""
echo "To connect via CDP:"
echo "   curl http://localhost:9222/json/version"
echo ""
