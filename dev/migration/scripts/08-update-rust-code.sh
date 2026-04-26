#!/bin/bash
#
# Phase 3: Update Rust Code
#

set -e

WORKSPACE="$HOME/Desktop/allternit-workspace/allternit"

echo "=========================================="
echo "Phase 3: Update Rust Code"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$WORKSPACE"

# Count files to process
RUST_FILES=$(find . -name "*.rs" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./target/*" | wc -l)
echo "Found $RUST_FILES Rust files to check"
echo ""

# 3.1 Update Rust source files
echo "3.1 Updating Rust source files..."
echo "    (This may take a few minutes)"
echo ""

# Update comments and strings
find . -name "*.rs" -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./target/*" | while read -r file; do
    # Update Allternit comments
    sed -i.bak \
        -e 's/#! # Allternit /#! # Allternit /g' \
        -e 's/# Allternit /# Allternit /g' \
        -e 's/"allternit"/"allternit"/g' \
        -e 's/\/tmp\/allternit/\/tmp\/allternit/g' \
        -e 's/\.join("allternit")/.join("allternit")/g' \
        "$file" 2>/dev/null || true
    
    rm -f "$file.bak"
done

echo -e "  ${GREEN}✓${NC} Updated Rust source files"

# 3.2 Update Cargo.toml files
echo ""
echo "3.2 Updating Cargo.toml files..."

find . -name "Cargo.toml" -not -path "./node_modules/*" | while read -r file; do
    # Update package names
    sed -i.bak \
        -e 's/name = "allternit-/name = "allternit-/g' \
        -e 's/allternit-/allternit-/g' \
        "$file" 2>/dev/null || true
    
    rm -f "$file.bak"
done

echo -e "  ${GREEN}✓${NC} Updated Cargo.toml files"

# 3.3 Check for remaining issues
echo ""
echo "3.3 Checking for remaining allternit references..."
REMAINING=$(grep -r "allternit" --include="*.rs" . 2>/dev/null | grep -v node_modules | grep -v target | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "  ${YELLOW}!${NC} Found $REMAINING remaining references (manual review needed)"
    grep -r "allternit" --include="*.rs" . 2>/dev/null | grep -v node_modules | grep -v target | head -10
else
    echo -e "  ${GREEN}✓${NC} No allternit references found in Rust files"
fi

echo ""
echo -e "${GREEN}Phase 3 complete!${NC}"
