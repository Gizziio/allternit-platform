#!/bin/bash
# Convert all Allternit templates to Universal Plugin SDK format
# Uses the allternit-plugin CLI for consistent conversion

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Allternit Template → Plugin Converter                  ║"
echo "║     Universal Plugin SDK v1.0.0                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
SDK_DIR="${SDK_DIR:-/Users/macbook/allternit-plugin-sdk}"
OUTPUT_DIR="${OUTPUT_DIR:-/Users/macbook/allternit-plugins}"
TEMPLATE_DIR="${TEMPLATE_DIR:-/Users/macbook/allternit}"
ADAPTERS="${ADAPTERS:-mcp,http,cli}"

# Check SDK exists
if [ ! -f "$SDK_DIR/bin/allternit-plugin.js" ]; then
    echo -e "${RED}❌ SDK not found at $SDK_DIR${NC}"
    echo "Set SDK_DIR environment variable or run from SDK directory"
    exit 1
fi

CLI="$SDK_DIR/bin/allternit-plugin.js"

echo "Configuration:"
echo "  SDK:      $SDK_DIR"
echo "  Output:   $OUTPUT_DIR"
echo "  Templates: $TEMPLATE_DIR"
echo "  Adapters: $ADAPTERS"
echo ""

# Find templates
echo "🔍 Scanning for templates..."
TEMPLATE_COUNT=$(find "$TEMPLATE_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l | tr -d ' ')

if [ "$TEMPLATE_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No templates found in $TEMPLATE_DIR${NC}"
    echo ""
    echo "Searched for: *.tsx, *.ts, *.js, *.jsx"
    echo ""
    echo "To specify a different directory:"
    echo "  TEMPLATE_DIR=/path/to/templates ./scripts/convert-all.sh"
    exit 1
fi

echo "Found $TEMPLATE_COUNT template files"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Use CLI for batch conversion
echo -e "${BLUE}Starting batch conversion...${NC}"
echo ""

# Check if CLI supports convert-all
if node "$CLI" convert-all --help 2>/dev/null | grep -q "convert-all"; then
    # Use new CLI command
    node "$CLI" convert-all \
        --input "$TEMPLATE_DIR" \
        --output "$OUTPUT_DIR" \
        --adapters "$ADAPTERS"
else
    # Fallback: manual batch processing
    echo "Using fallback batch processing..."
    echo ""
    
    CONVERTED=0
    FAILED=0
    
    find "$TEMPLATE_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) | while read -r file; do
        name=$(basename "$file" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g')
        output="$OUTPUT_DIR/${name}-plugin"
        
        if [ -d "$output" ]; then
            echo -e "${YELLOW}  SKIP${NC} ${name} (already exists)"
            continue
        fi
        
        printf "  Converting ${name}... "
        
        if node "$CLI" convert --input "$file" --output "$output" 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            CONVERTED=$((CONVERTED + 1))
        else
            echo -e "${RED}✗${NC}"
            FAILED=$((FAILED + 1))
        fi
    done
    
    echo ""
    echo "═══════════════════════════════════════"
    echo "  Batch Conversion Complete"
    echo "═══════════════════════════════════════"
    echo "  Converted: $CONVERTED"
    echo "  Failed:    $FAILED"
fi

echo ""
echo -e "${GREEN}✅ Conversion complete!${NC}"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo "Plugins created: $(ls -1 "$OUTPUT_DIR" 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "Next steps:"
echo "  1. Review converted plugins in $OUTPUT_DIR"
echo "  2. Customize src/index.ts with template-specific logic"
echo "  3. Build all: cd $OUTPUT_DIR && for d in */; do (cd \"\$d\" && npm install && npm run build); done"
echo "  4. Publish to NPM: npm publish --access public"
echo ""
