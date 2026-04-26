#!/bin/bash
#
# Phase 2: Rename Workspace Directories and Files
#

set -e

WORKSPACE="$HOME/Desktop/allternit-workspace/allternit"
BACKUP_DIR="$HOME/Desktop/allternit-workspace-backup-$(date +%Y%m%d)"

echo "=========================================="
echo "Phase 2: Rename Workspace Directories"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check workspace exists
if [ ! -d "$WORKSPACE" ]; then
    echo -e "${RED}Error: Workspace not found at $WORKSPACE${NC}"
    exit 1
fi

cd "$WORKSPACE"

# 2.1 Rename .allternit directory
echo "2.1 Renaming .allternit directory..."
if [ -d ".allternit" ]; then
    if [ -d ".allternit" ]; then
        echo -e "${YELLOW}Warning: .allternit already exists, merging...${NC}"
        cp -R .allternit/* .allternit/ 2>/dev/null || true
        rm -rf .allternit
    else
        mv .allternit .allternit
        echo -e "  ${GREEN}✓${NC} Renamed .allternit → .allternit"
    fi
else
    echo -e "  ${YELLOW}-${NC} .allternit not found (may already be renamed)"
fi

# 2.2 Rename binaries
echo ""
echo "2.2 Renaming binaries..."
cd "$WORKSPACE/bin"

if [ -f "allternit" ]; then
    mv allternit allternit
    echo -e "  ${GREEN}✓${NC} Renamed bin/allternit → bin/allternit"
fi

if [ -f "allternit-stage" ]; then
    mv allternit-stage allternit-stage
    echo -e "  ${GREEN}✓${NC} Renamed bin/allternit-stage → bin/allternit-stage"
fi

if [ -f "a2-test" ]; then
    mv a2-test allternit-test
    echo -e "  ${GREEN}✓${NC} Renamed bin/a2-test → bin/allternit-test"
fi

# 2.3 Clean old distribution files
echo ""
echo "2.3 Cleaning old distribution files..."
cd "$WORKSPACE/distribution"

if ls allternit-platform-*.tar.gz 1> /dev/null 2>&1; then
    rm -f allternit-platform-*.tar.gz
    echo -e "  ${GREEN}✓${NC} Removed old tar.gz files"
fi

if [ -f "allternit.sh" ]; then
    rm -f allternit.sh
    echo -e "  ${GREEN}✓${NC} Removed allternit.sh"
fi

# 2.4 Rename documentation
echo ""
echo "2.4 Renaming documentation..."
cd "$WORKSPACE/docs"

if [ -f "MCP_APPS_Allternit_INTEGRATION.md" ]; then
    mv MCP_APPS_Allternit_INTEGRATION.md MCP_APPS_ALLTERNIT_INTEGRATION.md
    echo -e "  ${GREEN}✓${NC} Renamed docs/MCP_APPS_Allternit_INTEGRATION.md"
fi

# 2.5 Remove old workspace
echo ""
echo "2.5 Removing old allternit-workspace..."
if [ -d "$HOME/Desktop/allternit-workspace" ]; then
    rm -rf "$HOME/Desktop/allternit-workspace"
    echo -e "  ${GREEN}✓${NC} Removed ~/Desktop/allternit-workspace"
else
    echo -e "  ${YELLOW}-${NC} Old workspace not found (already removed)"
fi

echo ""
echo -e "${GREEN}Phase 2 complete!${NC}"
