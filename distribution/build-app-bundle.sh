#!/bin/bash
# Build a macOS .app bundle that FEELS like a single binary
# but is actually an app bundle (the macOS standard)

set -e

echo "========================================"
echo "A2R Platform - macOS App Bundle Build"
echo "========================================"

VERSION="0.1.0"
APP_NAME="A2R Platform"
APP_BUNDLE="$APP_NAME.app"
BUILD_DIR="build"
DIST_DIR="dist/app-bundle"

# Directories
API_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/api"
UI_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell-ui"
ELECTRON_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell-electron"

mkdir -p "$DIST_DIR"

# Step 1: Build API
echo "Building Rust API..."
cd "$API_DIR"
cargo build --release

# Step 2: Build UI
echo "Building UI..."
cd "$UI_DIR"
pnpm install 2>/dev/null || true
pnpm build

# Step 3: Create App Bundle Structure
echo "Creating app bundle..."
rm -rf "$BUILD_DIR/$APP_BUNDLE"
mkdir -p "$BUILD_DIR/$APP_BUNDLE/Contents/"{MacOS,Resources,Frameworks}

# Create the main executable that manages both
cat > "$BUILD_DIR/$APP_BUNDLE/Contents/MacOS/$APP_NAME" << 'MAIN'
#!/bin/bash

# A2R Platform Launcher Script
# This script manages the Rust API sidecar and Electron UI

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_BIN="$APP_DIR/Resources/a2rchitech-api"
UI_DIR="$APP_DIR/Resources/ui"
PID_FILE="$TMPDIR/a2r-platform.pid"
LOG_FILE="$TMPDIR/a2r-platform.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[A2R]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    log "Shutting down..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            wait "$PID" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    exit 0
}

trap cleanup EXIT INT TERM

# Check if API is already running
check_api() {
    curl -s http://127.0.0.1:3010/health > /dev/null 2>&1
}

# Start API
start_api() {
    log "Starting API server..."
    
    export A2R_OPERATOR_URL="http://127.0.0.1:3010"
    export A2R_DATA_DIR="$HOME/Library/Application Support/A2R Platform"
    export RUST_LOG="info"
    
    mkdir -p "$A2R_DATA_DIR"
    
    "$API_BIN" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    
    # Wait for API to be ready
    log "Waiting for API..."
    for i in {1..30}; do
        if check_api; then
            log "API is ready!"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    error "API failed to start"
    return 1
}

# Open browser
open_ui() {
    log "Opening A2R Platform..."
    open "http://127.0.0.1:3010"
}

# Main
log "Starting A2R Platform v0.1.0"
log "App directory: $APP_DIR"

# Check if already running
if check_api; then
    log "A2R Platform is already running"
    open_ui
    exit 0
fi

# Start services
start_api
open_ui

log "A2R Platform is running!"
log "Press Ctrl+C to stop"

# Keep script running
tail -f /dev/null &
wait
MAIN

chmod +x "$BUILD_DIR/$APP_BUNDLE/Contents/MacOS/$APP_NAME"

# Copy API binary
cp "target/release/a2rchitech-api" "$BUILD_DIR/$APP_BUNDLE/Contents/Resources/"
chmod +x "$BUILD_DIR/$APP_BUNDLE/Contents/Resources/a2rchitech-api"

# Copy UI
cp -r "$UI_DIR/dist" "$BUILD_DIR/$APP_BUNDLE/Contents/Resources/ui"

# Create Info.plist
cat > "$BUILD_DIR/$APP_BUNDLE/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>A2R Platform</string>
    <key>CFBundleDisplayName</key>
    <string>A2R Platform</string>
    <key>CFBundleIdentifier</key>
    <string>com.a2rchitech.platform</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# Create DMG
echo "Creating DMG installer..."
if command -v create-dmg &> /dev/null; then
    create-dmg \
        --volname "$APP_NAME" \
        --window-pos 200 120 \
        --window-size 800 400 \
        --icon-size 100 \
        --icon "$APP_NAME" 200 190 \
        --hide-extension "$APP_NAME" \
        --app-drop-link 600 185 \
        "$DIST_DIR/A2R-Platform-$VERSION.dmg" \
        "$BUILD_DIR/$APP_BUNDLE" || true
else
    echo "create-dmg not found, creating zip instead"
    cd "$BUILD_DIR"
    zip -r "../$DIST_DIR/A2R-Platform-$VERSION-mac.zip" "$APP_BUNDLE"
fi

# Copy app bundle
cp -r "$BUILD_DIR/$APP_BUNDLE" "$DIST_DIR/"

# Summary
echo ""
echo "========================================"
echo "Build Complete!"
echo "========================================"
echo ""
echo "Output:"
ls -lh "$DIST_DIR"
echo ""
echo "To run:"
echo "  Double-click: $DIST_DIR/$APP_BUNDLE"
echo "  Or run: open '$DIST_DIR/$APP_BUNDLE'"
echo ""
echo "The app bundle feels like a single binary"
echo "but actually contains both the UI and API."
echo ""
