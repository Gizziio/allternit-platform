#!/bin/bash
#
# Allternit Rebranding - Step 1: Rename Configuration Directories
# 
# This script renames .config directories from old branding (allternit) to new branding (allternit)
#

set -e

echo "=========================================="
echo "Allternit Rebranding - Step 1"
echo "Renaming Configuration Directories"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CONFIG_DIR="$HOME/.config"

# Directory mappings
rename_dir() {
    local old_name="$1"
    local new_name="$2"
    local old_path="$CONFIG_DIR/$old_name"
    local new_path="$CONFIG_DIR/$new_name"
    
    if [ -d "$old_path" ]; then
        if [ -d "$new_path" ]; then
            echo -e "${YELLOW}Warning: $new_path already exists, merging...${NC}"
            cp -R "$old_path/"* "$new_path/" 2>/dev/null || true
            rm -rf "$old_path"
        else
            mv "$old_path" "$new_path"
            echo -e "  ${GREEN}✓${NC} Renamed $old_name → $new_name"
        fi
    else
        echo -e "  ${YELLOW}-${NC} $old_name not found (skipping)"
    fi
}

echo "Directory rename plan:"
echo "----------------------"
echo -e "  ${YELLOW}allternit${NC} → ${GREEN}allternit${NC}"
echo -e "  ${YELLOW}allternit-chrome-dev${NC} → ${GREEN}allternit-chrome-dev${NC}"
echo -e "  ${YELLOW}allternit-code${NC} → ${GREEN}allternit-code${NC}"
echo -e "  ${YELLOW}allternit-extension-test${NC} → ${GREEN}allternit-extension-test${NC}"
echo ""

# Check if any directories exist
ANY_FOUND=false
for dir in "$CONFIG_DIR/allternit" "$CONFIG_DIR/allternit-chrome-dev" "$CONFIG_DIR/allternit-code" "$CONFIG_DIR/allternit-extension-test"; do
    if [ -d "$dir" ]; then
        ANY_FOUND=true
        break
    fi
done

if [ "$ANY_FOUND" = false ]; then
    echo -e "${GREEN}No old configuration directories found. Nothing to do.${NC}"
    exit 0
fi

# Create backup
echo "Creating backup..."
BACKUP_DIR="$HOME/.allternit-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/config"

# Backup old directories before renaming
for dir in allternit allternit-chrome-dev allternit-code allternit-extension-test; do
    if [ -d "$CONFIG_DIR/$dir" ]; then
        cp -R "$CONFIG_DIR/$dir" "$BACKUP_DIR/config/" 2>/dev/null || true
    fi
done

echo -e "${GREEN}Backup created at: $BACKUP_DIR${NC}"
echo ""

# Perform renames
echo "Renaming directories..."
rename_dir "allternit" "allternit"
rename_dir "allternit-chrome-dev" "allternit-chrome-dev"
rename_dir "allternit-code" "allternit-code"
rename_dir "allternit-extension-test" "allternit-extension-test"

echo ""
echo -e "${GREEN}Directory renaming complete!${NC}"
echo ""
echo "Next step: Run 02-update-config-contents.sh"
