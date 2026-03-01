#!/bin/bash
# A2R Platform - Portable Distribution Builder
# 
# Creates a portable distribution that:
# - Contains the launcher, API, and UI in one directory
# - Can be run from any location
# - Works on macOS, Linux, and Windows (WSL)

set -e

echo "========================================"
echo "A2R Platform - Portable Build"
echo "========================================"

# Configuration
VERSION="0.1.0"
DIST_NAME="a2r-platform"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
BUILD_DIR="build/portable"
DIST_DIR="dist"

# Directories (relative to workspace root)
API_DIR="7-apps/api"
CLI_DIR="7-apps/cli"
UI_DIR="7-apps/shell-ui"
ELECTRON_DIR="7-apps/shell-electron"
LAUNCHER_DIR="distribution/launcher-simplified"
LAUNCHER_DESKTOP_DIR="distribution/launcher-desktop"

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

# Determine workspace root - script is in a2rchitech/distribution/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

info "Script: $SCRIPT_DIR"
info "Workspace: $WORKSPACE_ROOT"
export WORKSPACE_ROOT

info "Workspace: $WORKSPACE_ROOT"
info "Platform: $PLATFORM ($ARCH)"
echo ""

# Clean previous builds
info "Cleaning previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/$DIST_NAME"

# Step 1: Build API and CLI
echo ""
info "Step 1/4: Building API server and CLI..."
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

# Step 2: Build UI
echo ""
info "Step 2/4: Preparing UI assets..."

# Check if dist already exists
if [ -d "$UI_DIR/dist" ] && [ -f "$UI_DIR/dist/index.html" ]; then
    info "Using existing UI build from $UI_DIR/dist"
    mkdir -p "$BUILD_DIR/$DIST_NAME/ui"
    cp -r "$UI_DIR/dist/"* "$BUILD_DIR/$DIST_NAME/ui/"
    success "UI assets copied from existing build"
else
    warn "No existing UI build found, attempting to build..."
    cd "$UI_DIR"
    if [ ! -d "node_modules" ]; then
        info "Installing dependencies..."
        pnpm install --silent 2>&1 | tail -5 || true
    fi
    info "Building static assets..."
    pnpm build 2>&1 || warn "Build had errors, attempting to continue..."
    cd "$WORKSPACE_ROOT"
    if [ -d "$UI_DIR/dist" ]; then
        mkdir -p "$BUILD_DIR/$DIST_NAME/ui"
        cp -r "$UI_DIR/dist/"* "$BUILD_DIR/$DIST_NAME/ui/"
        success "UI assets built"
    else
        error "UI build failed completely"
        exit 1
    fi
fi

# Step 3: Build Launchers
echo ""
info "Step 3/4: Building launchers..."

# Build browser launcher
cd "$LAUNCHER_DIR"
cargo build --release --quiet 2>&1 | grep -v "Compiling\|Finished\|Running" || true
cd "$WORKSPACE_ROOT"
cp "$LAUNCHER_DIR/target/release/a2r-launcher" "$BUILD_DIR/$DIST_NAME/"
chmod +x "$BUILD_DIR/$DIST_NAME/a2r-launcher"

# Build desktop launcher
cd "$LAUNCHER_DESKTOP_DIR"
cargo build --release --quiet 2>&1 | grep -v "Compiling\|Finished\|Running" || true
cd "$WORKSPACE_ROOT"
cp "$LAUNCHER_DESKTOP_DIR/target/release/a2r-desktop" "$BUILD_DIR/$DIST_NAME/"
chmod +x "$BUILD_DIR/$DIST_NAME/a2r-desktop"

success "Launchers built"

# Step 4: Create wrapper scripts
echo ""
info "Step 4/4: Creating wrapper scripts..."

# macOS/Linux wrapper script
cat > "$BUILD_DIR/$DIST_NAME/start.sh" << 'EOF'
#!/bin/bash
# A2R Platform Launcher
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export A2R_STATIC_DIR="$DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/.a2r-platform}"
./a2r-launcher "$@"
EOF
chmod +x "$BUILD_DIR/$DIST_NAME/start.sh"

# Copy Electron files if they exist (node_modules NOT included - requires global Electron)
if [ -d "$ELECTRON_DIR" ]; then
    info "Copying Electron shell files..."
    mkdir -p "$BUILD_DIR/$DIST_NAME/electron"
    cp "$ELECTRON_DIR/main/"*.cjs "$BUILD_DIR/$DIST_NAME/electron/" 2>/dev/null || true
    cp "$ELECTRON_DIR/preload/"*.js "$BUILD_DIR/$DIST_NAME/electron/" 2>/dev/null || true
    cp "$ELECTRON_DIR/package.json" "$BUILD_DIR/$DIST_NAME/electron/"
    # Note: node_modules NOT copied - requires global Electron install
    # Desktop launcher will fall back to browser if Electron not found
fi

# CLI wrapper script (Unix) - starts API if not running
cat > "$BUILD_DIR/$DIST_NAME/start-cli.sh" << 'EOF'
#!/bin/bash
# A2R Platform CLI Launcher (starts API if needed)
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export A2R_STATIC_DIR="$DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/.a2r-platform}"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m'

# Check if API is already running
API_PID=""
if ! curl -s http://127.0.0.1:3010/health > /dev/null 2>&1; then
    echo -e "${BLUE}[A2R CLI]${NC} Starting API server..."
    ./a2rchitech-api &
    API_PID=$!
    
    # Wait for API to be ready
    for i in {1..30}; do
        if curl -s http://127.0.0.1:3010/health > /dev/null 2>&1; then
            echo -e "${GREEN}[A2R CLI]${NC} API ready!"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo "ERROR: API failed to start"
            exit 1
        fi
    done
fi

# Run the CLI command
./a2rchitech "$@"
EXIT_CODE=$?

# Shutdown API if we started it
if [ -n "$API_PID" ]; then
    kill $API_PID 2>/dev/null || true
    wait $API_PID 2>/dev/null || true
fi

exit $EXIT_CODE
EOF
chmod +x "$BUILD_DIR/$DIST_NAME/start-cli.sh"

# Desktop (Electron) wrapper script
cat > "$BUILD_DIR/$DIST_NAME/start-desktop.sh" << 'EOF'
#!/bin/bash
# A2R Platform Desktop Launcher (Electron mode)
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
export A2R_STATIC_DIR="$DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/.a2r-platform}"
./a2r-desktop "$@"
EOF
chmod +x "$BUILD_DIR/$DIST_NAME/start-desktop.sh"

# Windows wrapper script
cat > "$BUILD_DIR/$DIST_NAME/start.bat" << 'EOF'
@echo off
:: A2R Platform Launcher for Windows
setlocal EnableDelayedExpansion
set "DIR=%~dp0"
cd /d "%DIR%"
set "A2R_STATIC_DIR=%DIR%ui"
set "A2R_OPERATOR_URL=http://127.0.0.1:3010"
set "A2R_DATA_DIR=%USERPROFILE%\.a2r-platform"
a2r-launcher.exe %*
pause
EOF

# macOS app bundle structure
mkdir -p "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/"{MacOS,Resources}
cp "$BUILD_DIR/$DIST_NAME/a2r-launcher" "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/MacOS/"
cp "$BUILD_DIR/$DIST_NAME/a2rchitech-api" "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/Resources/"
cp -r "$BUILD_DIR/$DIST_NAME/ui" "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/Resources/"

cat > "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/MacOS/A2R Platform" << 'EOF'
#!/bin/bash
DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
cd "$DIR"
export A2R_STATIC_DIR="$DIR/ui"
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/Library/Application Support/A2R Platform}"
"$DIR/../MacOS/a2r-launcher"
EOF
chmod +x "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/MacOS/A2R Platform"

cat > "$BUILD_DIR/$DIST_NAME/A2R Platform.app/Contents/Info.plist" << EOF
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
    <string>A2R Platform</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

success "Wrapper scripts created"

# Create README
cat > "$BUILD_DIR/$DIST_NAME/README.txt" << 'EOF'
A2R Platform - Portable Distribution
====================================

QUICK START:
- macOS: Double-click "A2R Platform.app" or run ./start.sh
- Linux: Run ./start.sh
- Windows: Run start.bat

DIRECTORY STRUCTURE:
  a2r-desktop            - Desktop launcher (API + Electron)
  a2r-launcher           - Browser launcher (API + browser)
  a2rchitech-api         - API server binary
  a2rchitech             - CLI tool (commands + TUI)
  ui/                    - Static UI assets
  electron/              - Electron shell files
  start-desktop.sh       - Desktop mode launcher
  start.sh               - Browser mode launcher
  start-cli.sh           - CLI mode launcher
  A2R Platform.app/      - macOS app bundle (browser mode)

THREE WAYS TO RUN:

1. DESKTOP MODE (Electron) - RECOMMENDED
   ./start-desktop.sh
   - Native desktop window (like a real app)
   - System tray, global hotkeys, native menus
   - Requires Electron: npm install -g electron
   - Falls back to browser if Electron not available
   
2. BROWSER MODE (Web UI)
   ./start.sh
   - Opens your default browser
   - Full web interface
   
3. TERMINAL MODE (CLI/TUI) - Self-contained
   ./start-cli.sh tui               # Interactive terminal UI (auto-starts API)
   ./start-cli.sh status            # Check system status (auto-starts API)
   ./start-cli.sh health            # Check API health
   ./start-cli.sh sessions          # List sessions
   ./start-cli.sh doctor            # Run diagnostics
   
   # Or use CLI directly (requires API already running):
   ./a2rchitech --help              # Show all commands

ENVIRONMENT VARIABLES:
  A2R_OPERATOR_URL       - API server URL (default: http://127.0.0.1:3010)
  A2R_DATA_DIR           - Data directory
  A2R_STATIC_DIR         - UI assets directory

PORTABLE MODE:
This is a portable distribution that stores all data in:
  - macOS: ~/Library/Application Support/A2R Platform
  - Linux: ~/.a2r-platform
  - Windows: %USERPROFILE%\.a2r-platform

You can move this folder anywhere and it will still work.

SUPPORT:
Visit https://a2rchitech.xyz for documentation and support.
EOF

# Package distribution
echo ""
info "Packaging distribution..."
mkdir -p "$DIST_DIR"

OUTPUT_NAME="$DIST_NAME-$VERSION-$PLATFORM-$ARCH"

# Create tar.gz
tar -czf "$DIST_DIR/${OUTPUT_NAME}.tar.gz" -C "$BUILD_DIR" "$DIST_NAME"

# Also create zip for Windows compatibility
cd "$BUILD_DIR" && zip -rq "$WORKSPACE_ROOT/$DIST_DIR/${OUTPUT_NAME}.zip" "$DIST_NAME" && cd "$WORKSPACE_ROOT"

success "Packaged: ${OUTPUT_NAME}.tar.gz and .zip"

# Summary
echo ""
echo "========================================"
echo "BUILD COMPLETE"
echo "========================================"
echo ""
echo "Output:"
ls -lh "$DIST_DIR" | grep -v "^total"
echo ""
echo "Distribution contents:"
du -sh "$BUILD_DIR/$DIST_NAME"/* 2>/dev/null | sort -h
echo ""
echo "To run:"
echo "  cd $DIST_DIR"
echo "  tar -xzf ${OUTPUT_NAME}.tar.gz"
echo "  cd $DIST_NAME"
echo "  ./start.sh"
echo ""
