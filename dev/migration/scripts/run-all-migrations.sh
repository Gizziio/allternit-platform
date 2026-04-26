#!/bin/bash
#
# Allternit Rebranding - Master Migration Script
#
# This script runs all migration steps in order
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Allternit Rebranding - Master Migration"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Rename configuration directories"
echo "  2. Update configuration file contents"
echo "  3. Update documentation files"
echo "  4. Verify all changes"
echo ""

# Check if running in correct directory
if [ ! -d "$HOME/.config" ]; then
    echo "Error: Cannot find ~/.config directory"
    exit 1
fi

echo -n "Do you want to proceed? (yes/no): "
read -r response

if [ "$response" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Starting migration..."
echo ""

# Run each step
STEP=1
TOTAL=4

run_step() {
    local script="$1"
    local name="$2"
    
    echo ""
    echo "=========================================="
    echo "Step $STEP of $TOTAL: $name"
    echo "=========================================="
    echo ""
    
    if [ -f "$SCRIPT_DIR/$script" ]; then
        chmod +x "$SCRIPT_DIR/$script"
        "$SCRIPT_DIR/$script"
    else
        echo "Error: Script not found: $script"
        exit 1
    fi
    
    ((STEP++))
}

# Execute migration steps
run_step "01-rename-config-dirs.sh" "Rename Configuration Directories"
run_step "02-update-config-contents.sh" "Update Configuration Contents"
run_step "03-update-documentation.sh" "Update Documentation Files"
run_step "04-verify-migration.sh" "Verify Migration"

echo ""
echo "=========================================="
echo "Migration Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Configuration directories renamed"
echo "  - Configuration files updated"
echo "  - Documentation files updated"
echo "  - Verification passed"
echo ""
echo "Please review the changes and restart any running services."
