#!/bin/bash
#
# allternit-extension-applescript.sh — Load Allternit Extension via AppleScript
#
# Uses macOS AppleScript to load the unpacked Allternit extension
# into Chrome without restarting it. Requires Chrome to be running.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

EXTENSION_DIR="$PROJECT_ROOT/surfaces/allternit-extensions/allternit-extension"
EXTENSION_BUILD_DIR="$EXTENSION_DIR/.output/chrome-mv3"

echo "🍎 Allternit Extension — AppleScript Loader"
echo "======================================"
echo ""

# Build if needed
if [ ! -d "$EXTENSION_BUILD_DIR" ]; then
  echo "⚠️  Extension not built. Running 'wxt build'..."
  cd "$EXTENSION_DIR"
  npx wxt build || {
    echo "✗ Build failed."
    exit 1
  }
fi

echo "📦 Loading extension: $EXTENSION_BUILD_DIR"
echo ""

# Check if Chrome is running
if ! pgrep -x "Google Chrome" > /dev/null 2>&1; then
  echo "✗ Google Chrome is not running. Start it first, then retry."
  exit 1
fi

# Use AppleScript to open chrome://extensions in a new tab
osascript <<EOF
tell application "Google Chrome"
    activate
    tell window 1
        set newTab to make new tab with properties {URL:"chrome://extensions"}
    end tell
end tell
EOF

echo ""
echo "✅ Opened chrome://extensions in Chrome"
echo ""
echo "Now manually:"
echo "  1. Toggle 'Developer mode' ON (top-right)"
echo "  2. Click 'Load unpacked'"
echo "  3. Select: $EXTENSION_BUILD_DIR"
echo ""
echo "Or use the load-extension script instead:"
echo "  bin/allternit-extension-load.sh"
