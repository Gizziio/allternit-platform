#!/bin/bash
#
# Full Rebrand - Master Script
# Runs all phases of the rebrand
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Allternit Full Rebrand - Master Script"
echo "=========================================="
echo ""
echo "This script will:"
echo "  1. Remove old workspace"
echo "  2. Rename directories and files"
echo "  3. Update Rust code"
echo "  4. Update TypeScript/JavaScript code"
echo "  5. Update build scripts"
echo ""
echo "WARNING: This will modify the workspace extensively!"
echo ""

# Check if user wants to proceed
echo -n "Have you backed up the workspace? (yes/no): "
read -r backed_up

if [ "$backed_up" != "yes" ]; then
    echo ""
    echo "Please backup first:"
    echo "  cp -R ~/Desktop/allternit-workspace ~/Desktop/allternit-workspace-backup-$(date +%Y%m%d)"
    exit 1
fi

echo ""
echo -n "Do you want to proceed with the full rebrand? (yes/no): "
read -r proceed

if [ "$proceed" != "yes" ]; then
    echo "Rebrand cancelled."
    exit 0
fi

echo ""
echo "Starting full rebrand..."
echo ""

# Make all scripts executable
chmod +x "$SCRIPT_DIR"/*.sh

# Run each phase
phases=(
    "07-rename-workspace-dirs.sh:Rename Directories and Files"
    "08-update-rust-code.sh:Update Rust Code"
    "09-update-typescript.sh:Update TypeScript/JavaScript"
    "10-update-build-scripts.sh:Update Build Scripts"
)

for phase_info in "${phases[@]}"; do
    script="${phase_info%%:*}"
    name="${phase_info##*:}"
    
    echo ""
    echo "=========================================="
    echo "Running: $name"
    echo "=========================================="
    echo ""
    
    "$SCRIPT_DIR/$script"
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "ERROR: Phase failed - $name"
        echo "Check output above for errors."
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "Full Rebrand Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Verify changes: grep -r 'allternit' --include='*.rs' --include='*.ts' ."
echo "  2. Test build: cargo check"
echo "  3. Update NPM packages (manual step)"
echo "  4. Restart services"
echo ""
echo "See FULL_REBRAND_PLAN.md for details."
