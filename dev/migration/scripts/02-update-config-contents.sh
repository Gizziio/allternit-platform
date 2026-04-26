#!/bin/bash
#
# Allternit Rebranding - Step 2: Update Configuration File Contents
#
# This script updates the contents of configuration files with new branding
#

set -euo pipefail

echo "=========================================="
echo "Allternit Rebranding - Step 2"
echo "Updating Configuration File Contents"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONFIG_DIR="$HOME/.config"

# Files to update
CONFIG_FILES=(
    "allternit/config.toml"
    "allternit-shell/allternit.json"
)

echo "Files to be updated:"
echo "--------------------"
for file in "${CONFIG_FILES[@]}"; do
    full_path="$CONFIG_DIR/$file"
    if [ -f "$full_path" ]; then
        echo -e "  ${YELLOW}$file${NC}"
    else
        echo -e "  ${YELLOW}$file${NC} (not found)"
    fi
done
echo ""

# Update allternit/config.toml (formerly allternit/config.toml)
CONFIG_TOML="$CONFIG_DIR/allternit/config.toml"
if [ -f "$CONFIG_TOML" ]; then
    echo "Updating $CONFIG_TOML..."
    
    # Create backup
    cp "$CONFIG_TOML" "$CONFIG_TOML.bak.$(date +%Y%m%d)"
    
    # Update content
    sed -i.bak \
        -e 's|api\.allternit\.cloud|api.allternit.com|g' \
        -e 's|/var/run/allternit/|/var/run/allternit/|g' \
        -e 's|/usr/local/bin/allternitd|/usr/local/bin/allternitd|g' \
        -e 's|allternit\.dev|allternit.com|g' \
        "$CONFIG_TOML" 2>/dev/null || true
    
    rm -f "$CONFIG_TOML.bak"
    echo -e "  ${GREEN}✓${NC} Updated config.toml"
fi

# Update allternit-shell/allternit.json - rename file and update contents
Allternit_JSON="$CONFIG_DIR/allternit-shell/allternit.json"
ALLTERNIT_JSON="$CONFIG_DIR/allternit-shell/allternit.json"

if [ -f "$Allternit_JSON" ]; then
    echo "Updating allternit.json..."
    
    # Update content
    sed -i.bak \
        -e 's|https://allternit\.dev/|https://allternit.com/|g' \
        -e 's|allternit\.dev|allternit.com|g' \
        "$Allternit_JSON" 2>/dev/null || true
    
    rm -f "$Allternit_JSON.bak"
    
    # Rename file
    mv "$Allternit_JSON" "$ALLTERNIT_JSON"
    echo -e "  ${GREEN}✓${NC} Renamed allternit.json → allternit.json and updated contents"
fi

# Update package.json files in .config directories
echo ""
echo "Updating package.json files..."

find "$CONFIG_DIR" -name "package.json" -type f 2>/dev/null | while read -r pkg_file; do
    if grep -q "@allternit/" "$pkg_file" 2>/dev/null; then
        echo "  Updating: $pkg_file"
        sed -i.bak \
            -e 's|@allternit/|@allternit/|g' \
            "$pkg_file" 2>/dev/null || true
        rm -f "$pkg_file.bak"
        echo -e "    ${GREEN}✓${NC} Updated @allternit/ → @allternit/"
    fi
done

echo ""
echo -e "${GREEN}Configuration file updates complete!${NC}"
echo ""
echo "Next step: Run 03-update-documentation.sh"
