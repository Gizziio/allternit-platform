#!/bin/bash
# Install A2R Native Messaging Host for Chrome/Edge/Brave

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NATIVE_HOST_DIR="$SCRIPT_DIR/../native-host"
MANIFEST_NAME="com.a2r.desktop.json"

# Determine OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Chrome extension IDs (update these with your actual extension IDs)
EXTENSION_IDS=(
    "chrome-extension://YOUR_CHROME_EXTENSION_ID/"
    "chrome-extension://YOUR_EDGE_EXTENSION_ID/"
)

echo "Installing A2R Native Messaging Host..."
echo "OS: $OS"

# Create manifest with correct path
MANIFEST_PATH="$NATIVE_HOST_DIR/$MANIFEST_NAME"
HOST_PATH="$SCRIPT_DIR/../bin/a2r-native-host"

if [[ "$OS" == "macos" ]]; then
    HOST_PATH="${HOST_PATH//\//\\/}"
fi

# Replace placeholder in manifest
sed "s|HOST_PATH_PLACEHOLDER|$HOST_PATH|g" "$NATIVE_HOST_DIR/$MANIFEST_NAME.template" > "$MANIFEST_PATH.tmp"

# Add allowed origins
ORIGINS_JSON=$(printf '%s\n' "${EXTENSION_IDS[@]}" | jq -R . | jq -s .)
jq ".allowed_origins = $ORIGINS_JSON" "$MANIFEST_PATH.tmp" > "$MANIFEST_PATH"
rm "$MANIFEST_PATH.tmp"

# Install location
if [[ "$OS" == "macos" ]]; then
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
    BRAVE_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
else
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
    BRAVE_DIR="$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
fi

# Create directories and copy manifest
for DIR in "$CHROME_DIR" "$EDGE_DIR" "$BRAVE_DIR"; do
    if [[ -d "$(dirname "$DIR")" ]]; then
        echo "Installing for: $DIR"
        mkdir -p "$DIR"
        cp "$MANIFEST_PATH" "$DIR/"
    fi
done

echo "Native messaging host installed successfully!"
echo ""
echo "Next steps:"
echo "1. Build the native host binary: cargo build --release -p a2r-native-host"
echo "2. Copy binary to: $HOST_PATH"
echo "3. Install the extension in developer mode"
echo "4. Reload browser tabs"
