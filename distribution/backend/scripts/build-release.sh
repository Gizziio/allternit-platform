#!/bin/bash
#
# Build A2R Backend Release Binaries
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/target/release"
DIST_DIR="$PROJECT_ROOT/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[DONE]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get version from Cargo.toml
get_version() {
    grep "^version" "$PROJECT_ROOT/Cargo.toml" | head -1 | cut -d'"' -f2
}

# Build all binaries
build_binaries() {
    log_info "Building release binaries..."
    
    cd "$PROJECT_ROOT"
    
    # Build workspace in release mode
    cargo build --release --workspace
    
    log_success "Binaries built"
}

# Package binaries for distribution
package_binaries() {
    local version=$1
    local target=$2
    
    log_info "Packaging for $target..."
    
    # Create temp directory
    local tmpdir=$(mktemp -d)
    local pkg_name="a2r-backend-${version}-${target}"
    local pkg_dir="$tmpdir/$pkg_name"
    
    mkdir -p "$pkg_dir/bin"
    mkdir -p "$pkg_dir/web"
    mkdir -p "$pkg_dir/scripts"
    
    # Copy binaries
    cp "$BUILD_DIR/a2r-api" "$pkg_dir/bin/" 2>/dev/null || log_warn "a2r-api not found"
    cp "$BUILD_DIR/a2r-kernel" "$pkg_dir/bin/" 2>/dev/null || log_warn "a2r-kernel not found"
    cp "$BUILD_DIR/a2r-memory" "$pkg_dir/bin/" 2>/dev/null || log_warn "a2r-memory not found"
    cp "$BUILD_DIR/a2r-workspace" "$pkg_dir/bin/" 2>/dev/null || log_warn "a2r-workspace not found"
    
    # Copy web assets
    if [ -d "$PROJECT_ROOT/7-apps/shell/dist" ]; then
        cp -r "$PROJECT_ROOT/7-apps/shell/dist" "$pkg_dir/web/"
    fi
    
    # Copy install script
    cp "$SCRIPT_DIR/../deploy/install.sh" "$pkg_dir/"
    chmod +x "$pkg_dir/install.sh"
    
    # Copy service definitions
    cp -r "$SCRIPT_DIR/../deploy/services" "$pkg_dir/" 2>/dev/null || true
    
    # Create archive
    mkdir -p "$DIST_DIR"
    cd "$tmpdir"
    
    if [[ "$target" == *"windows"* ]]; then
        zip -r "$DIST_DIR/${pkg_name}.zip" "$pkg_name"
    else
        tar -czf "$DIST_DIR/${pkg_name}.tar.gz" "$pkg_name"
    fi
    
    # Cleanup
    rm -rf "$tmpdir"
    
    log_success "Package created: $DIST_DIR/${pkg_name}.tar.gz"
}

# Generate checksums
generate_checksums() {
    log_info "Generating checksums..."
    
    cd "$DIST_DIR"
    sha256sum *.tar.gz *.zip > SHA256SUMS 2>/dev/null || true
    
    log_success "Checksums: $DIST_DIR/SHA256SUMS"
}

# Main
main() {
    local version=$(get_version)
    
    echo "=========================================="
    echo "A2R Backend Release Builder"
    echo "Version: $version"
    echo "=========================================="
    echo ""
    
    mkdir -p "$DIST_DIR"
    
    build_binaries
    
    # Package for each target
    local targets=("x86_64-linux" "aarch64-linux" "x86_64-macos" "aarch64-macos")
    
    for target in "${targets[@]}"; do
        # Note: In a real cross-compilation setup, we'd use cross or cargo-zigbuild
        # For now, just package for current architecture
        if [[ "$target" == *"linux"* ]] && [[ "$(uname -s)" == "Linux" ]]; then
            package_binaries "$version" "$target"
        elif [[ "$target" == *"macos"* ]] && [[ "$(uname -s)" == "Darwin" ]]; then
            package_binaries "$version" "$target"
        fi
    done
    
    generate_checksums
    
    echo ""
    echo "=========================================="
    log_success "Release build complete!"
    echo "Output: $DIST_DIR/"
    echo "=========================================="
}

main "$@"
