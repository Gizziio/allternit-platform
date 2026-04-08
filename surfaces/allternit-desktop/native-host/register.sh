#!/bin/bash
# Register Native Messaging Host for A2R Desktop
# This script installs the native messaging host manifest for Chrome/Edge

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="com.a2r.native_host"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Create directories
mkdir -p "$TARGET_DIR"
mkdir -p "$EDGE_DIR"

# Get the actual host path
# In development, use node script
# In production, use bundled binary
if [ -f "$SCRIPT_DIR/../node_modules/.bin/ts-node" ]; then
    HOST_PATH="$SCRIPT_DIR/native-host.ts"
else
    HOST_PATH="$SCRIPT_DIR/native-host"
fi

# Create manifest for Chrome
MANIFEST=$(cat "$SCRIPT_DIR/$HOST_NAME.json" | sed "s|HOST_PATH|$HOST_PATH|g")
echo "$MANIFEST" > "$TARGET_DIR/$HOST_NAME.json"

# Create manifest for Edge
echo "$MANIFEST" > "$EDGE_DIR/$HOST_NAME.json"

echo "✅ Native messaging host registered:"
echo "   Chrome: $TARGET_DIR/$HOST_NAME.json"
echo "   Edge:   $EDGE_DIR/$HOST_NAME.json"
echo ""
echo "Host path: $HOST_PATH"
