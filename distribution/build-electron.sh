#!/bin/bash
# A2R Platform - Electron Desktop Distribution Builder
# 
# Creates a true desktop app distribution with:
# - Electron shell (desktop window)
# - Rust API (backend)
# - CLI tool (optional terminal interface)

set -e

echo "========================================"
echo "A2R Platform - Electron Desktop Build"
echo "========================================"

# Configuration
VERSION="0.1.0"
DIST_NAME="a2r-platform-desktop"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
BUILD_DIR="build/electron"
DIST_DIR="dist"

# Directories
API_DIR="7-apps/api"
CLI_DIR="7-apps/cli"
ELECTRON_DIR="7-apps/shell-electron"
UI_DIR="7-apps/shell-ui"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Determine workspace root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

info "Workspace: $WORKSPACE_ROOT"
info "Platform: $PLATFORM ($ARCH)"
echo ""

# Clean previous builds
info "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/$DIST_NAME"

# Step 1: Build API and CLI
echo ""
info "Step 1/4: Building API and CLI..."
cd "$API_DIR"
cargo build --release --quiet 2>&1 | grep -v "Compiling\|Finished\|Running" || true
cd "$WORKSPACE_ROOT"
cp "target/release/a2rchitech-api" "$BUILD_DIR/$DIST_NAME/"
chmod +x "$BUILD_DIR/$DIST_NAME/a2rchitech-api"

# Build CLI
cd "$CLI_DIR"
cargo build --release --quiet 2>&1 | grep -v "Compiling\|Finished\|Running" || true
cd "$WORKSPACE_ROOT"
cp "target/release/a2rchitech" "$BUILD_DIR/$DIST_NAME/"
chmod +x "$BUILD_DIR/$DIST_NAME/a2rchitech"
success "API and CLI binaries built"

# Step 2: Prepare UI and Electron
echo ""
info "Step 2/4: Preparing UI and Electron assets..."

# Check if UI dist exists
if [ -d "$UI_DIR/dist" ] && [ -f "$UI_DIR/dist/index.html" ]; then
    info "Using existing UI build from $UI_DIR/dist"
    mkdir -p "$BUILD_DIR/$DIST_NAME/ui"
    cp -r "$UI_DIR/dist/"* "$BUILD_DIR/$DIST_NAME/ui/"
else
    error "UI build not found. Please build the UI first:"
    error "  cd $UI_DIR && pnpm build"
    exit 1
fi

# Build Electron
info "Building Electron shell..."
cd "$ELECTRON_DIR"
npm run build 2>&1 | tail -10 || true
cd "$WORKSPACE_ROOT"

# Copy Electron files
mkdir -p "$BUILD_DIR/$DIST_NAME/electron"
cp "$ELECTRON_DIR/main/"*.cjs "$BUILD_DIR/$DIST_NAME/electron/" 2>/dev/null || true
cp "$ELECTRON_DIR/preload/"*.js "$BUILD_DIR/$DIST_NAME/electron/" 2>/dev/null || true
cp "$ELECTRON_DIR/package.json" "$BUILD_DIR/$DIST_NAME/electron/"

# Copy node_modules for Electron
info "Copying Electron dependencies..."
cp -r "$ELECTRON_DIR/node_modules" "$BUILD_DIR/$DIST_NAME/electron/"

success "Electron assets prepared"

# Step 3: Create launcher for Electron mode
echo ""
info "Step 3/4: Creating Electron launcher..."

cat > "$BUILD_DIR/$DIST_NAME/start-desktop.sh" << 'EOF'
#!/bin/bash
# A2R Platform Desktop Launcher (Electron)
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

export A2R_STATIC_DIR="$DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/.a2r-platform}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[A2R Desktop]${NC} Starting A2R Platform Desktop..."
echo -e "${BLUE}[A2R Desktop]${NC} API: $A2R_OPERATOR_URL"
echo -e "${BLUE}[A2R Desktop]${NC} Data: $A2R_DATA_DIR"

# Start API in background
"$DIR/a2rchitech-api" &
API_PID=$!

# Wait for API to be ready
echo -e "${BLUE}[A2R Desktop]${NC} Waiting for API..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:3010/health > /dev/null 2>&1; then
        echo -e "${GREEN}[A2R Desktop]${NC} API ready!"
        break
    fi
    sleep 1
done

# Start Electron
echo -e "${BLUE}[A2R Desktop]${NC} Starting Electron..."
cd "$DIR/electron"
npx electron . &
ELECTRON_PID=$!

# Wait for Electron
echo -e "${GREEN}[A2R Desktop]${NC} A2R Platform Desktop is running!"
echo -e "${BLUE}[A2R Desktop]${NC} Press Ctrl+C to stop"

# Trap to cleanup
cleanup() {
    echo -e "${BLUE}[A2R Desktop]${NC} Shutting down..."
    kill $ELECTRON_PID 2>/dev/null || true
    kill $API_PID 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

wait
EOF
chmod +x "$BUILD_DIR/$DIST_NAME/start-desktop.sh"

success "Desktop launcher created"

# Step 4: Create macOS app bundle with Electron
echo ""
info "Step 4/4: Creating macOS Electron app bundle..."

# Create Electron.app structure
APP_NAME="A2R Platform Desktop.app"
APP_DIR="$BUILD_DIR/$DIST_NAME/$APP_NAME"

mkdir -p "$APP_DIR/Contents/"{MacOS,Resources,Frameworks}

# Create launcher script for app bundle
cat > "$APP_DIR/Contents/MacOS/A2R Platform Desktop" << 'EOF'
#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"

export A2R_STATIC_DIR="$APP_DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/Library/Application Support/A2R Platform Desktop}"

# Start API in background
"$APP_DIR/a2rchitech-api" &
API_PID=$!

# Wait for API
for i in {1..30}; do
    if curl -s http://127.0.0.1:3010/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Start Electron
cd "$APP_DIR/electron"
exec npx electron .
EOF
chmod +x "$APP_DIR/Contents/MacOS/A2R Platform Desktop"

# Copy resources
cp -r "$BUILD_DIR/$DIST_NAME/ui" "$APP_DIR/Contents/Resources/"
cp -r "$BUILD_DIR/$DIST_NAME/electron" "$APP_DIR/Contents/Resources/"
cp "$BUILD_DIR/$DIST_NAME/a2rchitech-api" "$APP_DIR/Contents/Resources/"
cp "$BUILD_DIR/$DIST_NAME/a2rchitech" "$APP_DIR/Contents/Resources/"
chmod +x "$APP_DIR/Contents/Resources/a2rchitech-api"
chmod +x "$APP_DIR/Contents/Resources/a2rchitech"

# Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>A2R Platform Desktop</string>
    <key>CFBundleDisplayName</key>
    <string>A2R Platform Desktop</string>
    <key>CFBundleIdentifier</key>
    <string>com.a2rchitech.desktop</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>A2R Platform Desktop</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Create README
cat > "$BUILD_DIR/$DIST_NAME/README.txt" << 'EOF'
A2R Platform Desktop - Electron Distribution
=============================================

QUICK START:
- macOS: Double-click "A2R Platform Desktop.app"
- Linux: Run ./start-desktop.sh

MODES AVAILABLE:

1. DESKTOP MODE (Electron) - RECOMMENDED
   ./start-desktop.sh
   - Native desktop window
   - System tray integration
   - Global hotkeys (Cmd/Ctrl+Shift+A)
   - No browser needed

2. WEB MODE (Browser)
   ./a2rchitech-api &
   open http://127.0.0.1:3010

3. CLI MODE
   ./a2rchitech status
   ./a2rchitech tui

DIRECTORY STRUCTURE:
  a2rchitech-api         - API server binary
  a2rchitech             - CLI tool
  ui/                    - Static UI assets
  electron/              - Electron shell files
  start-desktop.sh       - Desktop launcher

NOTE: Electron mode requires Node.js to be installed.
For a standalone Electron app, use electron-builder:
  cd electron && npx electron-builder

SUPPORT: https://a2rchitech.xyz
EOF

success "macOS Electron app bundle created"

# Package distribution
echo ""
info "Packaging distribution..."
mkdir -p "$DIST_DIR"

OUTPUT_NAME="$DIST_NAME-$VERSION-$PLATFORM-$ARCH"

# Create tar.gz
tar -czf "$DIST_DIR/${OUTPUT_NAME}.tar.gz" -C "$BUILD_DIR" "$DIST_NAME"

success "Packaged: ${OUTPUT_NAME}.tar.gz"

# Summary
echo ""
echo "========================================"
echo "BUILD COMPLETE"
echo "========================================"
echo ""
echo "Output:"
ls -lh "$DIST_DIR"/*.tar.gz 2>/dev/null | tail -5
echo ""
echo "Distribution contents:"
du -sh "$BUILD_DIR/$DIST_NAME"/* 2>/dev/null | sort -h
echo ""
echo "To run Desktop mode:"
echo "  cd $DIST_DIR"
echo "  tar -xzf ${OUTPUT_NAME}.tar.gz"
echo "  cd $DIST_NAME"
echo "  ./start-desktop.sh"
echo ""
echo "Or on macOS:"
echo "  Open 'A2R Platform Desktop.app'"
echo ""
