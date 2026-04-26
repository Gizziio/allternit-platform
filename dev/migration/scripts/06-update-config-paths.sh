#!/bin/bash
#
# Allternit Rebranding - Step 6: Update Config File Paths
#
# Updates package.json files that reference old workspace paths
#

set -e

echo "=========================================="
echo "Allternit Rebranding - Step 6"
echo "Updating Config File Paths"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONFIG_DIR="$HOME/.config"

# Update package.json files with old workspace paths
echo "Updating package.json files..."
echo "------------------------------"

# Function to update a package.json
update_package_json() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "Processing: $file"
        
        # Create backup
        cp "$file" "$file.bak.$(date +%Y%m%d)" 2>/dev/null || true
        
        # Update path references
        # Note: We update the path references to use the new naming convention
        # The actual workspace may need to be moved/renamed separately
        sed -i.bak \
            -e 's|allternit-workspace/allternit|allternit-workspace/allternit|g' \
            -e 's|/allternit/|/allternit/|g' \
            "$file" 2>/dev/null || true
        
        rm -f "$file.bak"
        echo -e "  ${GREEN}✓${NC} Updated"
    fi
}

# Update all config package.json files
for dir in allternit-code gizzi-code gizzi; do
    pkg_file="$CONFIG_DIR/$dir/package.json"
    if [ -f "$pkg_file" ]; then
        update_package_json "$pkg_file"
    fi
done

echo ""
echo "Note: The actual workspace directory on Desktop still needs to be renamed."
echo "This script only updated the references in config files."
echo ""
echo -e "${GREEN}Config path updates complete!${NC}"
