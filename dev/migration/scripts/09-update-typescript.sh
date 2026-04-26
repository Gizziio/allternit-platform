#!/bin/bash
#
# Phase 4: Update TypeScript/JavaScript Code
#

set -e

WORKSPACE="$HOME/Desktop/allternit-workspace/allternit"

echo "=========================================="
echo "Phase 4: Update TypeScript/JavaScript Code"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$WORKSPACE"

# Count files
TS_FILES=$(find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l)
echo "Found $TS_FILES TypeScript/JavaScript files to check"
echo ""

# 4.1 Update imports and references
echo "4.1 Updating imports and references..."
echo "    (This may take a few minutes)"
echo ""

find . \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -not -path "./node_modules/*" -not -path "./.git/*" | while read -r file; do
    # Update @allternit imports
    sed -i.bak \
        -e 's/@allternit\//@allternit\//g' \
        -e 's/"@allternit/"@allternit/g' \
        -e 's/"allternit"/"allternit"/g' \
        -e 's/\.allternit\//\.allternit\//g' \
        "$file" 2>/dev/null || true
    
    rm -f "$file.bak"
done

echo -e "  ${GREEN}✓${NC} Updated TypeScript/JavaScript files"

# 4.2 Update package.json files
echo ""
echo "4.2 Updating package.json files..."

find . -name "package.json" -not -path "./node_modules/*" | while read -r file; do
    # Update package names
    sed -i.bak \
        -e 's/"name": "@allternit\//"name": "@allternit\//g' \
        -e 's/"@allternit\//"@allternit\//g' \
        -e 's/"allternit"/"allternit"/g' \
        "$file" 2>/dev/null || true
    
    rm -f "$file.bak"
done

echo -e "  ${GREEN}✓${NC} Updated package.json files"

# 4.3 Check for remaining issues
echo ""
echo "4.3 Checking for remaining @allternit references..."
REMAINING=$(grep -r "@allternit" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" . 2>/dev/null | grep -v node_modules | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "  ${YELLOW}!${NC} Found $REMAINING remaining @allternit references"
    echo "    (These may be in node_modules which is OK, or need manual update)"
else
    echo -e "  ${GREEN}✓${NC} No @allternit references found in source files"
fi

echo ""
echo -e "${GREEN}Phase 4 complete!${NC}"
echo ""
echo "NOTE: NPM packages still need to be republished with @allternit scope"
