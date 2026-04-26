#!/bin/bash
#
# Allternit Rebranding - Step 4: Verify Migration
#
# This script verifies that all rebranding changes were applied correctly
#

set -euo pipefail

echo "=========================================="
echo "Allternit Rebranding - Step 4"
echo "Verification"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOME_DIR="$HOME"
ERRORS=0

echo "Checking for remaining old branding..."
echo "--------------------------------------"
echo ""

# Check 1: Config directories
echo "1. Checking configuration directories..."
OLD_CONFIG_DIRS=(
    ".config/allternit"
    ".config/allternit-chrome-dev"
    ".config/allternit-code"
    ".config/allternit-extension-test"
)

for dir in "${OLD_CONFIG_DIRS[@]}"; do
    full_path="$HOME_DIR/$dir"
    if [ -d "$full_path" ]; then
        echo -e "  ${RED}✗${NC} Old directory still exists: $dir"
        ((ERRORS++))
    fi
done

NEW_CONFIG_DIRS=(
    ".config/allternit"
    ".config/allternit-chrome-dev"
    ".config/allternit-code"
    ".config/allternit-extension-test"
)

for dir in "${NEW_CONFIG_DIRS[@]}"; do
    full_path="$HOME_DIR/$dir"
    if [ -d "$full_path" ]; then
        echo -e "  ${GREEN}✓${NC} New directory exists: $dir"
    fi
done
echo ""

# Check 2: Config file contents
echo "2. Checking configuration file contents..."

if [ -f "$HOME_DIR/.config/allternit/config.toml" ]; then
    if grep -q "allternit\.cloud" "$HOME_DIR/.config/allternit/config.toml" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} config.toml still contains allternit.cloud references"
        ((ERRORS++))
    else
        echo -e "  ${GREEN}✓${NC} config.toml updated"
    fi
fi

if [ -f "$HOME_DIR/.config/allternit-shell/allternit.json" ]; then
    echo -e "  ${RED}✗${NC} allternit.json should be renamed to allternit.json"
    ((ERRORS++))
fi

if [ -f "$HOME_DIR/.config/allternit-shell/allternit.json" ]; then
    if grep -q "allternit\.dev" "$HOME_DIR/.config/allternit-shell/allternit.json" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} allternit.json still contains allternit.dev references"
        ((ERRORS++))
    else
        echo -e "  ${GREEN}✓${NC} allternit.json updated"
    fi
fi
echo ""

# Check 3: Documentation files
echo "3. Checking documentation files..."

DOC_FILES=(
    "spec/Vision.md"
    "spec/Architecture.md"
    "ALLTERNIT_GAPS_HARDENING_ANALYSIS.md"
)

for file in "${DOC_FILES[@]}"; do
    full_path="$HOME_DIR/$file"
    if [ -f "$full_path" ]; then
        # Count occurrences of old branding
        Allternit_COUNT=$(grep -c "Allternit " "$full_path" 2>/dev/null || echo "0")
        if [ "$Allternit_COUNT" -gt 0 ]; then
            echo -e "  ${YELLOW}!${NC} $file still has $Allternit_COUNT 'Allternit' references (may be acceptable in historical context)"
        else
            echo -e "  ${GREEN}✓${NC} $file updated"
        fi
    fi
done
echo ""

# Check 4: Package.json files
echo "4. Checking package.json files..."

find "$HOME_DIR/.config" -name "package.json" -type f 2>/dev/null | while read -r pkg_file; do
    if grep -q '"@allternit/' "$pkg_file" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} $pkg_file still contains @allternit/ references"
    fi
done
echo ""

# Summary
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Verification PASSED!${NC}"
    echo "All rebranding changes have been applied successfully."
else
    echo -e "${RED}Verification FAILED with $ERRORS errors${NC}"
    echo "Please review the errors above and re-run the migration scripts."
    exit 1
fi
echo "=========================================="
