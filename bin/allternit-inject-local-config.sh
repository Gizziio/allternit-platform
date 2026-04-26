#!/bin/bash
#
# allternit-inject-local-config.sh — Inject Local Config via Chrome DevTools Protocol
#
# Injects local-mode configuration into the Allternit Extension running in Chrome
# by connecting to the Chrome DevTools Protocol (CDP) on port 9222.
#
# Prerequisites:
#   - Chrome must be running with --remote-debugging-port=9222
#   - Use bin/chrome-dev.sh to launch Chrome with CDP enabled
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CDP_PORT="${CDP_PORT:-9222}"

echo "🔧 Allternit Local Config Injector"
echo "============================"
echo ""

# Check if Chrome CDP is reachable
if ! curl -s "http://localhost:$CDP_PORT/json/version" > /dev/null 2>&1; then
  echo "✗ Chrome DevTools Protocol not reachable at port $CDP_PORT"
  echo ""
  echo "Launch Chrome with CDP first:"
  echo "  bin/chrome-dev.sh"
  exit 1
fi

echo "✅ Connected to Chrome CDP (port $CDP_PORT)"
echo ""

# Get the extension's DevTools page WebSocket URL
TARGET_URL="http://localhost:$CDP_PORT/json"
EXTENSION_TARGET=$(curl -s "$TARGET_URL" | python3 -c "
import sys, json
targets = json.load(sys.stdin)
for t in targets:
    if 'chrome-extension' in t.get('url', ''):
        print(t['webSocketDebuggerUrl'])
        sys.exit(0)
print('')
" 2>/dev/null)

if [ -z "$EXTENSION_TARGET" ]; then
  echo "✗ No Allternit extension page found in Chrome"
  echo "  Make sure the extension is loaded (chrome://extensions)"
  exit 1
fi

echo "📎 Found extension DevTools target"
echo ""

# Inject local configuration via localStorage
echo "💉 Injecting local config..."
curl -s -X POST "$TARGET_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": 1,
    \"method\": \"Runtime.evaluate\",
    \"params\": {
      \"expression\": \"localStorage.setItem('allternit-mode', 'local'); localStorage.setItem('allternit-config', JSON.stringify({backend: 'http://127.0.0.1:8080', debug: true})); console.log('Allternit local config injected')\"
    }
  }" > /dev/null 2>&1

echo "✅ Local configuration injected into Allternit extension"
echo "   Mode: local"
echo "   Backend: http://127.0.0.1:8080"
echo "   Debug: enabled"
