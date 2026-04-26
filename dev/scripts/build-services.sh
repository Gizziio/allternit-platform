#!/bin/bash
#
# Build allternit Services
#
# This script compiles all Rust services to binaries for production use.
# Run this once, then use 'allternit start' to launch pre-built binaries.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}     ${GREEN}Allternit - Build Services${NC}                        ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}     ${BLUE}Compiling for Production${NC}                             ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[BUILD]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Create dist directory
mkdir -p "$DIST_DIR"

# Build a Rust service
build_rust_service() {
    local name=$1
    local manifest_path=$2
    local output_name=$3
    
    print_status "Building $name..."
    
    cd "$PROJECT_ROOT"
    
    # Build release binary
    if cargo build --release --manifest-path "$manifest_path" 2>&1 | tee "$DIST_DIR/${name}-build.log"; then
        # Find and copy the binary
        local binary_path="$PROJECT_ROOT/target/release/${output_name:-$name}"
        if [ -f "$binary_path" ]; then
            cp "$binary_path" "$DIST_DIR/"
            print_success "$name built successfully"
            return 0
        else
            # Try to find binary name from Cargo.toml
            local cargo_name=$(grep -E '^name\s*=' "$manifest_path" | head -1 | sed 's/.*"\(.*\)".*/\1/')
            if [ -n "$cargo_name" ]; then
                binary_path="$PROJECT_ROOT/target/release/$cargo_name"
                if [ -f "$binary_path" ]; then
                    cp "$binary_path" "$DIST_DIR/"
                    print_success "$name built successfully (as $cargo_name)"
                    return 0
                fi
            fi
            print_error "Could not find binary for $name"
            return 1
        fi
    else
        print_error "$name build failed"
        return 1
    fi
}

print_header

print_status "Building Rust services (this may take 10-20 minutes)..."
echo ""

# Track build results
BUILT=0
FAILED=0

# Build Policy Service
if build_rust_service "policy" "2-governance/policy/Cargo.toml" "policy"; then
    ((BUILT++))
else
    ((FAILED++))
fi

# Build Memory Service
if build_rust_service "memory" "4-services/memory/Cargo.toml" "memory"; then
    ((BUILT++))
else
    ((FAILED++))
fi

# Build Registry Service
if build_rust_service "registry" "4-services/registry/registry-server/Cargo.toml" "registry-server"; then
    ((BUILT++))
else
    ((FAILED++))
fi

# Build Kernel
if build_rust_service "kernel" "4-services/orchestration/kernel-service/Cargo.toml" "kernel"; then
    ((BUILT++))
else
    ((FAILED++))
fi

# Build API
if build_rust_service "api" "6-apps/api/Cargo.toml" "api"; then
    ((BUILT++))
else
    ((FAILED++))
fi

# Build Platform Orchestrator
if build_rust_service "platform" "4-services/orchestration/platform-orchestration-service/Cargo.toml" "allternit-platform"; then
    ((BUILT++))
else
    ((FAILED++))
fi

echo ""
print_success "Build complete!"
echo ""
echo -e "Built: ${GREEN}$BUILT${NC} services"
echo -e "Failed: ${RED}$FAILED${NC} services"
echo ""
echo "Binaries are in: $DIST_DIR"
echo ""
echo "To start with pre-built binaries:"
echo "  allternit start"
