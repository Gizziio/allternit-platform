#!/bin/bash
#
# A2R Unified Platform Build Script
# 
# Builds Desktop with bundled backend for current platform
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[BUILD]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Detect platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Normalize platform names
if [ "$PLATFORM" = "darwin" ]; then
  PLATFORM_NAME="macos"
  ELECTRON_PLATFORM="darwin"
elif [ "$PLATFORM" = "linux" ]; then
  PLATFORM_NAME="linux"
  ELECTRON_PLATFORM="linux"
else
  PLATFORM_NAME="windows"
  ELECTRON_PLATFORM="win32"
fi

# Normalize arch
if [ "$ARCH" = "x86_64" ]; then
  ARCH_NAME="x86_64"
  ELECTRON_ARCH="x64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ARCH_NAME="aarch64"
  ELECTRON_ARCH="arm64"
else
  log_error "Unsupported architecture: $ARCH"
  exit 1
fi

log_info "Building for $PLATFORM_NAME ($ARCH_NAME)"
echo ""

# Step 1: Build Backend
# =============================================================================
log_info "Step 1: Building A2R Backend..."

cd "$PROJECT_ROOT/7-apps/a2r-api"

if [ ! -f "Cargo.toml" ]; then
  log_error "Backend Cargo.toml not found"
  exit 1
fi

cargo build --release

log_success "Backend built"
echo ""

# Step 2: Prepare Bundled Backend
# =============================================================================
log_info "Step 2: Preparing bundled backend..."

cd "$PROJECT_ROOT/7-apps/a2r-desktop"

# Create directory structure
BUNDLE_DIR="bundled-backend/${ELECTRON_PLATFORM}/${ELECTRON_ARCH}"
mkdir -p "$BUNDLE_DIR/bin"
mkdir -p "$BUNDLE_DIR/web"

# Copy backend binary
BACKEND_BINARY="$PROJECT_ROOT/7-apps/a2r-api/target/release/a2r-api"
if [ ! -f "$BACKEND_BINARY" ]; then
  # Try alternative binary names
  BACKEND_BINARY="$PROJECT_ROOT/7-apps/a2r-api/target/release/a2r_api"
fi

if [ -f "$BACKEND_BINARY" ]; then
  cp "$BACKEND_BINARY" "$BUNDLE_DIR/bin/"
  log_success "Copied backend binary"
else
  log_warn "Backend binary not found at $BACKEND_BINARY"
  log_warn "Desktop will need to download backend on first run"
fi

# Make executable on Unix
if [ "$PLATFORM" != "mingw" ] && [ "$PLATFORM" != "msys" ]; then
  chmod +x "$BUNDLE_DIR/bin/"* 2>/dev/null || true
fi

echo ""

# Step 3: Build Desktop
# =============================================================================
log_info "Step 3: Building A2R Desktop..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  log_info "Installing npm dependencies..."
  npm install
fi

# Build TypeScript
log_info "Building TypeScript..."
npm run build

# Build Electron app
log_info "Building Electron app..."
npm run build:prod

log_success "Desktop built"
echo ""

# Step 4: Summary
# =============================================================================
log_info "Build complete!"
echo ""
echo "Output:"
echo "  Bundled backend: $BUNDLE_DIR"
echo "  Desktop package: release/"
echo ""

# List output files
if [ -d "release" ]; then
  echo "Generated files:"
  ls -lh release/*.{dmg,exe,AppImage,zip} 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || true
fi

echo ""
echo "Next steps:"
echo "  1. Test the app: npm run start"
echo "  2. Distribute: Upload release/ files to GitHub"
