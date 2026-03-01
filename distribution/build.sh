#!/bin/bash
# Build script for OpenClaw single-binary distribution
# N30: Single-binary build pipeline

set -e

echo "========================================"
echo "OpenClaw Build Pipeline"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RELEASE_DIR="target/release"
DIST_DIR="dist"
VERSION=$(grep '^version' Cargo.toml | head -1 | cut -d'"' -f2)

echo "Building version: $VERSION"

# Create dist directory
mkdir -p "$DIST_DIR"

# Step 1: Clean previous builds
echo ""
echo -e "${YELLOW}Step 1: Cleaning previous builds...${NC}"
cargo clean

# Step 2: Run tests
echo ""
echo -e "${YELLOW}Step 2: Running tests...${NC}"
echo "Running MCP unit tests..."
cargo test -p a2r-mcp --lib

echo "Running MCP integration tests..."
cargo test -p a2r-mcp --test integration_test

echo "Running API unit tests..."
cargo test -p a2rchitech-api --lib

echo "Running OpenClaw bridge integration tests..."
cargo test -p a2rchitech-api --test openclaw_bridge_integration

# Step 3: Format check
echo ""
echo -e "${YELLOW}Step 3: Checking code formatting...${NC}"
cargo fmt -- --check

# Step 4: Clippy linting
echo ""
echo -e "${YELLOW}Step 4: Running clippy...${NC}"
cargo clippy -- -D warnings

# Step 5: Build release binaries
echo ""
echo -e "${YELLOW}Step 5: Building release binaries...${NC}"
cargo build --release

# Step 6: Copy artifacts
echo ""
echo -e "${YELLOW}Step 6: Copying artifacts...${NC}"
mkdir -p "$DIST_DIR/lib"
mkdir -p "$DIST_DIR/include"

# Copy library files
if ls "$RELEASE_DIR"/*.rlib 1> /dev/null 2>&1; then
    cp "$RELEASE_DIR"/*.rlib "$DIST_DIR/lib/"
fi

if ls "$RELEASE_DIR"/*.a 1> /dev/null 2>&1; then
    cp "$RELEASE_DIR"/*.a "$DIST_DIR/lib/"
fi

if ls "$RELEASE_DIR"/*.so 1> /dev/null 2>&1; then
    cp "$RELEASE_DIR"/*.so "$DIST_DIR/lib/"
fi

if ls "$RELEASE_DIR"/*.dylib 1> /dev/null 2>&1; then
    cp "$RELEASE_DIR"/*.dylib "$DIST_DIR/lib/"
fi

if ls "$RELEASE_DIR"/*.dll 1> /dev/null 2>&1; then
    cp "$RELEASE_DIR"/*.dll "$DIST_DIR/lib/"
fi

# Step 7: Generate documentation
echo ""
echo -e "${YELLOW}Step 7: Generating documentation...${NC}"
cargo doc --no-deps --release

# Step 8: Create package manifest
echo ""
echo -e "${YELLOW}Step 8: Creating package manifest...${NC}"
cat > "$DIST_DIR/manifest.json" << EOF
{
  "name": "openclaw-core",
  "version": "$VERSION",
  "built_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "components": {
    "mcp_adapter": {
      "crate": "a2r-mcp",
      "description": "MCP protocol adapter with policy enforcement"
    },
    "api": {
      "crate": "a2rchitech-api",
      "description": "REST API server with OpenClaw bridge"
    }
  },
  "platform": {
    "os": "$(uname -s)",
    "arch": "$(uname -m)"
  }
}
EOF

# Step 9: Calculate checksums
echo ""
echo -e "${YELLOW}Step 9: Calculating checksums...${NC}"
if command -v shasum &> /dev/null; then
    (cd "$DIST_DIR" && find . -type f -exec shasum -a 256 {} \; > checksums.sha256)
elif command -v sha256sum &> /dev/null; then
    (cd "$DIST_DIR" && find . -type f -exec sha256sum {} \; > checksums.sha256)
fi

# Step 10: Summary
echo ""
echo "========================================"
echo -e "${GREEN}Build Complete!${NC}"
echo "========================================"
echo ""
echo "Distribution artifacts:"
echo "  Location: $DIST_DIR/"
echo ""
echo "Contents:"
ls -lh "$DIST_DIR/"
echo ""
echo -e "${GREEN}All tests passed and artifacts built successfully!${NC}"
