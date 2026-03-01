#!/bin/bash
# Build script for A2R Platform TRUE Single-Binary Distribution
# Everything embedded into one executable file

set -e

echo "========================================"
echo "A2R Platform Single-Binary Build"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
VERSION=$(grep '^version' Cargo.toml | head -1 | cut -d'"' -f2)
DIST_DIR="dist/single-binary"
LAUNCHER_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/launcher"
API_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/api"
UI_DIR="Desktop/a2rchitech-workspace/a2rchitech/7-apps/shell-ui"

echo "Building version: $VERSION"
echo ""

# Step 1: Build Rust API Binary
echo -e "${YELLOW}Step 1: Building Rust API binary...${NC}"
cd "$API_DIR"
cargo build --release

# Prepare embed directory
mkdir -p embed
cp "../../../../target/release/a2rchitech-api" embed/

echo -e "${GREEN}✓ API binary built${NC}"
echo "  Size: $(du -h embed/a2rchitech-api | cut -f1)"
echo ""

# Step 2: Build UI Assets
echo -e "${YELLOW}Step 2: Building UI assets...${NC}"
cd "$UI_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

pnpm build

echo -e "${GREEN}✓ UI assets built${NC}"
echo "  Size: $(du -sh dist | cut -f1)"
echo ""

# Step 3: Build Single-Binary Launcher
echo -e "${YELLOW}Step 3: Building single-binary launcher...${NC}"
cd "$LAUNCHER_DIR"

# Build with embedded assets
cargo build --release

echo -e "${GREEN}✓ Launcher built${NC}"
echo ""

# Step 4: Package Single Binary
echo -e "${YELLOW}Step 4: Packaging single binary...${NC}"
mkdir -p "../../../../$DIST_DIR"

# Determine binary name based on platform
BINARY_NAME="a2r-platform"
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    BINARY_NAME="a2r-platform.exe"
fi

# Copy the single binary
BINARY_PATH="../../../../$DIST_DIR/$BINARY_NAME"
cp "../../../../target/release/a2r-platform-launcher" "$BINARY_PATH"

# Compress with UPX if available (optional but recommended)
if command -v upx &> /dev/null; then
    echo "Compressing with UPX..."
    upx --best "$BINARY_PATH" || echo "UPX compression failed, continuing..."
fi

echo -e "${GREEN}✓ Single binary created${NC}"
echo "  Location: $BINARY_PATH"
echo "  Size: $(du -h "$BINARY_PATH" | cut -f1)"
echo ""

# Step 5: Create Platform-Specific Packages
echo -e "${YELLOW}Step 5: Creating platform packages...${NC}"

cd "../../../../$DIST_DIR"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - Create .app bundle
    echo "Creating macOS app bundle..."
    
    APP_NAME="A2R Platform.app"
    mkdir -p "$APP_NAME/Contents/MacOS"
    mkdir -p "$APP_NAME/Contents/Resources"
    
    # Copy binary
    cp "$BINARY_NAME" "$APP_NAME/Contents/MacOS/A2R Platform"
    chmod +x "$APP_NAME/Contents/MacOS/A2R Platform"
    
    # Create Info.plist
    cat > "$APP_NAME/Contents/Info.plist" << 'PLIST'
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
    <string>0.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>A2R Platform</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

    # Create DMG
    if command -v create-dmg &> /dev/null; then
        create-dmg \
            --volname "A2R Platform" \
            --window-pos 200 120 \
            --window-size 600 400 \
            --icon-size 100 \
            --app-drop-link 450 185 \
            "A2R-Platform-$VERSION.dmg" \
            "$APP_NAME" || echo "DMG creation failed"
    else
        # Fallback: just zip the app
        zip -r "A2R-Platform-$VERSION-mac.zip" "$APP_NAME"
    fi
    
    echo -e "${GREEN}✓ macOS package created${NC}"

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - Create AppImage
    echo "Creating Linux AppImage..."
    
    # Create AppDir structure
    APPDIR="A2R-Platform-$VERSION.AppDir"
    mkdir -p "$APPDIR/usr/bin"
    mkdir -p "$APPDIR/usr/share/applications"
    mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"
    
    # Copy binary
    cp "$BINARY_NAME" "$APPDIR/usr/bin/a2r-platform"
    
    # Create desktop entry
    cat > "$APPDIR/usr/share/applications/a2r-platform.desktop" << 'DESKTOP'
[Desktop Entry]
Name=A2R Platform
Exec=a2r-platform
Icon=a2r-platform
Type=Application
Categories=Development;
DESKTOP

    # Create AppRun script
    cat > "$APPDIR/AppRun" << 'APPRUN'
#!/bin/bash
HERE="$(dirname "$(readlink -f "${0}")")"
exec "$HERE/usr/bin/a2r-platform" "$@"
APPRUN
    chmod +x "$APPDIR/AppRun"
    
    # Create AppImage (requires appimagetool)
    if command -v appimagetool &> /dev/null; then
        ARCH=x86_64 appimagetool "$APPDIR" "A2R-Platform-$VERSION-x86_64.AppImage"
    else
        echo "appimagetool not found, creating tar.gz instead"
        tar -czf "A2R-Platform-$VERSION-linux.tar.gz" "$BINARY_NAME"
    fi
    
    echo -e "${GREEN}✓ Linux package created${NC}"

elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    echo "Creating Windows installer..."
    
    # Just keep the .exe for now
    # Could use Inno Setup or NSIS for proper installer
    echo -e "${GREEN}✓ Windows executable ready${NC}"
fi

# Step 6: Create manifest
echo ""
echo -e "${YELLOW}Step 6: Creating manifest...${NC}"
cat > "manifest.json" << EOF
{
  "name": "a2r-platform-single-binary",
  "version": "$VERSION",
  "built_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "architecture": "single-binary-embedded",
  "components": {
    "launcher": {
      "path": "a2r-platform",
      "description": "Rust launcher with embedded API + UI",
      "type": "self-extracting"
    }
  },
  "features": [
    "Single file executable",
    "Self-extracting on first run",
    "Embedded Rust API server",
    "Embedded UI assets",
    "Automatic cleanup",
    "Cross-platform"
  ],
  "size": {
    "bytes": $(stat -f%z "$BINARY_NAME" 2>/dev/null || stat -c%s "$BINARY_NAME" 2>/dev/null || echo "0"),
    "human": "$(du -h "$BINARY_NAME" | cut -f1)"
  }
}
EOF

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}Build Complete!${NC}"
echo "========================================"
echo ""
echo "Distribution artifacts:"
echo "  Location: $DIST_DIR/"
echo ""
ls -lh
echo ""
echo -e "${GREEN}✅ Single binary distribution ready!${NC}"
echo ""
echo "Usage:"
echo "  ./$BINARY_NAME"
echo ""
echo "Features:"
echo "  • One file - everything embedded"
echo "  • Double-click to start"
echo "  • Self-extracts on first run"
echo "  • Opens browser automatically"
echo "  • Caches extraction for fast startup"
echo ""
