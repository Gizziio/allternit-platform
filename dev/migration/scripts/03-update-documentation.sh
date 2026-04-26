#!/bin/bash
#
# Allternit Rebranding - Step 3: Update Documentation Files
#
# This script updates all documentation and spec files with new branding
#

set -euo pipefail

echo "=========================================="
echo "Allternit Rebranding - Step 3"
echo "Updating Documentation Files"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOME_DIR="$HOME"

# Files to update (relative to HOME)
# Format: "file_path|description"
FILES_TO_UPDATE=(
    # Spec files
    "spec/Vision.md|Allternit → Allternit"
    "spec/Architecture.md|Allternit → Allternit"
    "spec/Requirements.md|Allternit → Allternit"
    "spec/GAP_ANALYSIS.md|Allternit → Allternit"
    "spec/IMPLEMENTATION_STATUS.md|Allternit → Allternit"
    "spec/AcceptanceTests.md|Allternit → Allternit"
    "spec/00-PLANNING_DELIVERABLES.md|Allternit → Allternit"
    
    # ADR files
    "spec/ADRs/001-remote-detachable-cowork.md|Allternit → Allternit"
    "spec/ADRs/002-platform-native-scheduler.md|Allternit → Allternit"
    "spec/ADRs/003-terminal-control-surface.md|Allternit → Allternit"
    "spec/ADRs/004-event-ledger-replay.md|Allternit → Allternit"
    "spec/ADRs/005-checkpoint-recovery.md|Allternit → Allternit"
    
    # Implementation docs
    "ALLTERNIT_GAPS_HARDENING_ANALYSIS.md|Allternit → Allternit"
    "ALLTERNIT_WORKFLOW_BLUEPRINTS_PRODUCT_SPEC.md|Allternit → Allternit, allternit.io → allternit.com"
    "ALLTERNIT_BLUEPRINTS_ROADMAP.md|Allternit → Allternit"
    "ALLTERNIT_WORKFLOW_BLUEPRINTS_WITH_CONNECTORS.md|Allternit → Allternit"
    "ALLTERNIT_WORKFLOW_BLUEPRINTS_GROUNDED_SPEC.md|Allternit → Allternit"
    "ALLTERNIT_WORKFLOW_BLUEPRINTS_PLAN.md|Allternit → Allternit"
    "ALLTERNIT_WORKFLOW_PACKAGING.md|Allternit → Allternit"
)

echo "Documentation files to update:"
echo "------------------------------"
for item in "${FILES_TO_UPDATE[@]}"; do
    file_path="${item%%|*}"
    full_path="$HOME_DIR/$file_path"
    if [ -f "$full_path" ]; then
        echo -e "  ${YELLOW}$file_path${NC}"
    else
        echo -e "  ${RED}$file_path${NC} (not found)"
    fi
done
echo ""

# Function to update a file
update_file() {
    local file="$1"
    local full_path="$HOME_DIR/$file"
    
    if [ ! -f "$full_path" ]; then
        return 0
    fi
    
    echo "Updating: $file"
    
    # Create backup
    cp "$full_path" "$full_path.bak.$(date +%Y%m%d)" 2>/dev/null || true
    
    # Perform replacements
    # Note: Using sed with care for special characters
    
    # Replace Allternit with Allternit (but not in URLs like allternit.io)
    sed -i.bak \
        -e 's/Allternit Cowork/Allternit Cowork/g' \
        -e 's/Allternit Workflow/Allternit Workflow/g' \
        -e 's/Allternit Blueprint/Allternit Blueprint/g' \
        -e 's/Allternit Runtime/Allternit Runtime/g' \
        -e 's/Allternit Scheduler/Allternit Scheduler/g' \
        -e 's/Allternit Platform/Allternit Platform/g' \
        -e 's/Allternit Protocol/Allternit Protocol/g' \
        -e 's/The Allternit/The Allternit/g' \
        -e 's/by Allternit/by Allternit/g' \
        -e 's/Allternit Team/Allternit Team/g' \
        "$full_path" 2>/dev/null || true
    
    # Replace allternit.io with allternit.com
    sed -i.bak \
        -e 's/allternit\.io/allternit.com/g' \
        -e 's/api\.allternit\.io/api.allternit.com/g' \
        -e 's/blueprints\.allternit\.io/blueprints.allternit.com/g' \
        "$full_path" 2>/dev/null || true
    
    # Replace GitHub references
    sed -i.bak \
        -e 's|github\.com/allternit/|github.com/allternit/|g' \
        -e 's|github\.com/allternit-|github.com/allternit-|g' \
        "$full_path" 2>/dev/null || true
    
    rm -f "$full_path.bak"
    
    echo -e "  ${GREEN}✓${NC} Updated"
}

# Update each file
for item in "${FILES_TO_UPDATE[@]}"; do
    file_path="${item%%|*}"
    update_file "$file_path"
done

echo ""

# Additional pass for special cases
echo "Performing additional replacements..."

# Update apiVersion in blueprint examples
find "$HOME_DIR/spec" -name "*.md" -type f 2>/dev/null | while read -r file; do
    if grep -q "apiVersion: allternit.io" "$file" 2>/dev/null; then
        sed -i.bak 's|apiVersion: allternit.io|apiVersion: allternit.com|g' "$file" 2>/dev/null || true
        rm -f "$file.bak"
        echo -e "  ${GREEN}✓${NC} Updated apiVersion in $(basename "$file")"
    fi
done

echo ""
echo -e "${GREEN}Documentation updates complete!${NC}"
echo ""
echo "Next step: Run 04-update-launchagents.sh (if applicable)"
