#!/bin/bash
#
# allternit-extension-load.sh — Allternit Extension Loader
#
# Loads the Allternit Chrome extension into a fresh Chrome instance for testing.
# Uses the WXT-built extension from surfaces/allternit-extensions/allternit-extension/
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

EXTENSION_DIR="$PROJECT_ROOT/surfaces/allternit-extensions/allternit-extension"
CHROME_USER_DATA="$TMPDIR/allternit-extension-test-$$"
EXTENSION_BUILD_DIR="$EXTENSION_DIR/.output"

echo "🧩 Allternit Extension Loader"
echo "========================"
echo ""

# Check if WXT output exists; if not, build it first
if [ ! -d "$EXTENSION_BUILD_DIR/chrome-mv3" ]; then
  echo "⚠️  Extension not built yet. Running 'wxt build'..."
  cd "$EXTENSION_DIR"
  npx wxt build || {
    echo "✗ Build failed. Run 'cd $EXTENSION_DIR && npm run build' manually."
    exit 1
  }
fi

UNPACKED_EXT="$EXTENSION_BUILD_DIR/chrome-mv3"

if [ ! -d "$UNPACKED_EXT" ]; then
  echo "✗ Built extension not found at: $UNPACKED_EXT"
  exit 1
fi

echo "📦 Extension: $UNPACKED_EXT"
echo "👤 Chrome Profile: $CHROME_USER_DATA"
echo ""

# Launch Chrome with the extension loaded
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir="$CHROME_USER_DATA" \
  --load-extension="$UNPACKED_EXT" \
  --disable-background-networking \
  --disable-default-apps \
  --no-first-run \
  2>&1 &

echo "✅ Chrome launched with Allternit extension loaded"
echo "   PID: $!"
echo ""
echo "To load into an existing Chrome instance:"
echo "   1. Open chrome://extensions"
echo "   2. Enable Developer Mode"
echo "   3. Click 'Load unpacked' → select: $UNPACKED_EXT"
echo ""
echo "To clean up test profile:"
echo "   rm -rf $CHROME_USER_DATA"
