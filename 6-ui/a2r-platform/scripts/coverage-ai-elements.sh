#!/bin/bash
# AI Elements Coverage Gate
# 
# Fails CI if any official AI Elements component is missing from:
# 1. Local inventory (file exists)
# 2. Index exports (exported from src/components/ai-elements/index.ts)
# 3. Elements Lab registry (registered in src/components/ai-elements/registry.ts)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

CATALOG_FILE="./AI_ELEMENTS_OFFICIAL_CATALOG.json"
REGISTRY_FILE="./src/components/ai-elements/registry.ts"
INDEX_FILE="./src/components/ai-elements/index.ts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo "AI Elements Coverage Gate"
echo "=============================================="
echo ""

# Check if catalog exists
if [ ! -f "$CATALOG_FILE" ]; then
  echo -e "${RED}❌ FAIL: Official catalog not found: $CATALOG_FILE${NC}"
  echo "   Run: node scripts/scrape-ai-elements-catalog.mjs"
  exit 1
fi

# Check if registry exists
if [ ! -f "$REGISTRY_FILE" ]; then
  echo -e "${RED}❌ FAIL: Registry file not found: $REGISTRY_FILE${NC}"
  exit 1
fi

# Check if index exists
if [ ! -f "$INDEX_FILE" ]; then
  echo -e "${RED}❌ FAIL: Index file not found: $INDEX_FILE${NC}"
  exit 1
fi

# Count official components
TOTAL=$(jq length "$CATALOG_FILE")
echo "📋 Official components: $TOTAL"

# Check each official component
MISSING_FROM_REGISTRY=()
MISSING_FROM_INDEX=()
NOT_RENDERED_IN_LAB=()

for slug in $(jq -r '.[].slug' "$CATALOG_FILE"); do
  # Check if in registry
  if ! grep -q "id: \"$slug\"" "$REGISTRY_FILE" 2>/dev/null; then
    MISSING_FROM_REGISTRY+=("$slug")
  fi
  
  # Check if in index exports
  if ! grep -q "export.*from.*$slug" "$INDEX_FILE" 2>/dev/null; then
    MISSING_FROM_INDEX+=("$slug")
  fi
done

# Report results
echo ""

if [ ${#MISSING_FROM_REGISTRY[@]} -eq 0 ] && [ ${#MISSING_FROM_INDEX[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ PASS: All $TOTAL official components are registered${NC}"
else
  if [ ${#MISSING_FROM_REGISTRY[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing from registry.ts:${NC}"
    for slug in "${MISSING_FROM_REGISTRY[@]}"; do
      echo "   - $slug"
    done
    echo ""
  fi
  
  if [ ${#MISSING_FROM_INDEX[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing from index.ts exports:${NC}"
    for slug in "${MISSING_FROM_INDEX[@]}"; do
      echo "   - $slug"
    done
    echo ""
  fi
  
  exit 1
fi

# Verify count in registry by counting unique id patterns at start of lines
# The pattern "^\s\+id: \"" matches lines like:   id: "component-name",
REGISTRY_IDS=$(grep -E "^\s+id:\s*\"" "$REGISTRY_FILE" 2>/dev/null | wc -l | tr -d ' ')

echo "📊 Registry statistics:"
echo "   Components registered: $REGISTRY_IDS"

if [ "$REGISTRY_IDS" -ne "$TOTAL" ]; then
  echo -e "${YELLOW}⚠️  Warning: Registry has $REGISTRY_IDS components, expected $TOTAL${NC}"
  echo ""
  echo "   Official components not in registry:"
  for slug in $(jq -r '.[].slug' "$CATALOG_FILE"); do
    if ! grep -q "id: \"$slug\"" "$REGISTRY_FILE"; then
      echo "     - $slug"
    fi
  done
  exit 1
fi

echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo "   $TOTAL official AI Elements components are present and registered."
echo "=============================================="
