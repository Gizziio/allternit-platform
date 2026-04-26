#!/bin/bash
#
# Allternit Rebranding - Step 5: Update Workspace References
#
# This script updates references to old workspace structures and naming
#

set -e

echo "=========================================="
echo "Allternit Rebranding - Step 5"
echo "Updating Workspace References"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOME_DIR="$HOME"

# Update spec files to remove numbered layer system references
echo "Updating spec files..."
echo "----------------------"

SPEC_FILES=(
    "spec/IMPLEMENTATION_STATUS.md"
    "spec/GAP_ANALYSIS.md"
    "spec/00-PLANNING_DELIVERABLES.md"
    "spec/Architecture.md"
)

for file in "${SPEC_FILES[@]}"; do
    full_path="$HOME_DIR/$file"
    if [ -f "$full_path" ]; then
        echo "Processing: $file"
        
        # Create backup
        cp "$full_path" "$full_path.bak.workspace.$(date +%Y%m%d)" 2>/dev/null || true
        
        # Replace numbered layer system with generic descriptions
        sed -i.bak \
            -e 's|`1-kernel/execution/`|kernel execution layer|g' \
            -e 's|`1-kernel/infrastructure/`|kernel infrastructure layer|g' \
            -e 's|`1-kernel/cowork/`|cowork runtime layer|g' \
            -e 's|`7-apps/cli/`|CLI application|g' \
            -e 's|`7-apps/api/`|API server application|g' \
            -e 's|`6-ui/allternit-platform/`|UI platform layer|g' \
            -e 's|`0-substrate/`|substrate/infrastructure layer|g' \
            -e 's|/1-kernel/cowork/allternit-cowork-runtime/|`allternit-cowork-runtime` crate|g' \
            -e 's|/1-kernel/cowork/allternit-scheduler/|`allternit-scheduler` crate|g' \
            -e 's|/1-kernel/execution/allternit-vm-executor/|`allternit-vm-executor` crate|g' \
            -e 's|/7-apps/cli/|CLI module|g' \
            -e 's|/7-apps/api/|API module|g' \
            "$full_path" 2>/dev/null || true
        
        rm -f "$full_path.bak"
        echo -e "  ${GREEN}✓${NC} Updated"
    fi
done

echo ""

# Update documentation files
echo "Updating documentation files..."
echo "-------------------------------"

DOC_FILES=(
    "ALLTERNIT_CURRENT_STATE.md"
    "REBRANDING_AUDIT_REPORT.md"
    "REBRANDING_COMPLETION_REPORT.md"
)

for file in "${DOC_FILES[@]}"; do
    full_path="$HOME_DIR/$file"
    if [ -f "$full_path" ]; then
        echo "Processing: $file"
        
        cp "$full_path" "$full_path.bak.workspace.$(date +%Y%m%d)" 2>/dev/null || true
        
        sed -i.bak \
            -e 's|1-kernel/|kernel/|g' \
            -e 's|7-apps/|apps/|g' \
            -e 's|6-ui/|ui/|g' \
            -e 's|0-substrate/|substrate/|g' \
            -e 's|allternit-cowork-runtime|allternit-cowork-runtime|g' \
            -e 's|allternit-scheduler|allternit-scheduler|g' \
            -e 's|allternit-vm-executor|allternit-vm-executor|g' \
            "$full_path" 2>/dev/null || true
        
        rm -f "$full_path.bak"
        echo -e "  ${GREEN}✓${NC} Updated"
    fi
done

echo ""
echo -e "${GREEN}Workspace reference updates complete!${NC}"
