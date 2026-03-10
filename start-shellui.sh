#!/bin/bash
# Start Shell UI with headless Chrome (low memory)

# Kill existing Chrome
pkill -f "Google Chrome" 2>/dev/null || true
sleep 2

# Start headless Chrome with Shell UI
echo "Starting Headless Chrome with Shell UI..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-shellui \
  --window-size=1400,900 \
  --hide-scrollbars \
  --max_old_space_size=256 \
  --js-flags="--max-old-space-size=256" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows \
  --disable-extensions \
  --disable-sync \
  --enable-features=MemorySaverMode \
  http://localhost:5177 &

CHROME_PID=$!
echo "Chrome PID: $CHROME_PID"

# Wait for Chrome to start
sleep 3

# Check if Chrome is running
if kill -0 $CHROME_PID 2>/dev/null; then
    echo "✅ Chrome running on http://localhost:9222"
    echo "✅ Shell UI visible at http://localhost:5177"
    echo ""
    echo "Memory usage: ~200MB (vs 15GB for full Chrome)"
    echo ""
    echo "Commands:"
    echo "  agent-browser connect 9222"
    echo "  agent-browser screenshot shellui.png"
    echo "  agent-browser snapshot -i"
else
    echo "❌ Failed to start Chrome"
    exit 1
fi
