#!/bin/bash
# Register Allternit Desktop Native Messaging Host
# Installs the com.allternit.desktop manifest for Chrome/Edge so the extension
# can communicate with the Allternit Desktop app.
#
# Usage:
#   ./register.sh              # auto-detect dev vs production
#   ./register.sh --uninstall  # remove the manifest

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="com.allternit.desktop"
MANIFEST_FILE="$SCRIPT_DIR/$HOST_NAME.json"

# Build script path — production binary takes precedence
if [ -f "$SCRIPT_DIR/dist/native-host" ]; then
  HOST_PATH="$SCRIPT_DIR/dist/native-host"
elif command -v bun &>/dev/null && [ -f "$SCRIPT_DIR/native-host.ts" ]; then
  HOST_PATH="$(command -v bun) run $SCRIPT_DIR/native-host.ts"
else
  HOST_PATH="$SCRIPT_DIR/native-host.ts"
fi

# OS-specific Chrome/Edge manifest directories
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  exit 1
fi

if [[ "$1" == "--uninstall" ]]; then
  rm -f "$CHROME_DIR/$HOST_NAME.json" "$EDGE_DIR/$HOST_NAME.json"
  echo "✅ Unregistered $HOST_NAME"
  exit 0
fi

mkdir -p "$CHROME_DIR" "$EDGE_DIR"

MANIFEST=$(sed "s|HOST_PATH|$HOST_PATH|g" "$MANIFEST_FILE")
echo "$MANIFEST" > "$CHROME_DIR/$HOST_NAME.json"
echo "$MANIFEST" > "$EDGE_DIR/$HOST_NAME.json"

echo "✅ Registered $HOST_NAME"
echo "   Chrome: $CHROME_DIR/$HOST_NAME.json"
echo "   Edge:   $EDGE_DIR/$HOST_NAME.json"
echo "   Host:   $HOST_PATH"
