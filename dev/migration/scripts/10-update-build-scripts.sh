#!/bin/bash
#
# Phase 5: Update Build Scripts and Configuration
#

set -e

WORKSPACE="$HOME/Desktop/allternit-workspace/allternit"

echo "=========================================="
echo "Phase 5: Update Build Scripts"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$WORKSPACE"

# 5.1 Update build scripts
echo "5.1 Updating build scripts..."

SCRIPTS=(
    "distribution/build-electron.sh"
    "distribution/build-app-bundle.sh"
    "distribution/build-portable.sh"
    "distribution/build-single-binary.sh"
    "distribution/build.sh"
)

for script in "${SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        sed -i.bak \
            -e 's/allternit/allternit/g' \
            -e 's/Allternit/Allternit/g' \
            "$script" 2>/dev/null || true
        rm -f "$script.bak"
        echo -e "  ${GREEN}✓${NC} Updated $script"
    fi
done

# 5.2 Update environment files
echo ""
echo "5.2 Updating environment files..."

ENV_FILES=(
    ".env"
    ".env.example"
)

for env_file in "${ENV_FILES[@]}"; do
    if [ -f "$env_file" ]; then
        sed -i.bak \
            -e 's/allternit/allternit/g' \
            -e 's/Allternit/Allternit/g' \
            "$env_file" 2>/dev/null || true
        rm -f "$env_file.bak"
        echo -e "  ${GREEN}✓${NC} Updated $env_file"
    fi
done

# 5.3 Update config in .allternit
echo ""
echo "5.3 Updating config files in .allternit..."

if [ -d ".allternit" ]; then
    find .allternit -type f \( -name "*.json" -o -name "*.toml" -o -name "*.yaml" \) | while read -r config; do
        sed -i.bak \
            -e 's/allternit/allternit/g' \
            -e 's/Allternit/Allternit/g' \
            "$config" 2>/dev/null || true
        rm -f "$config.bak"
    done
    echo -e "  ${GREEN}✓${NC} Updated config files in .allternit"
fi

# 5.4 Update root Cargo.toml
echo ""
echo "5.4 Checking root Cargo.toml..."

if [ -f "Cargo.toml" ]; then
    # Check if there are old references
    if grep -q "allternit" Cargo.toml 2>/dev/null; then
        sed -i.bak \
            -e 's/allternit-/allternit-/g' \
            Cargo.toml
        rm -f Cargo.toml.bak
        echo -e "  ${GREEN}✓${NC} Updated Cargo.toml"
    else
        echo -e "  ${GREEN}✓${NC} Cargo.toml already clean"
    fi
fi

echo ""
echo -e "${GREEN}Phase 5 complete!${NC}"
