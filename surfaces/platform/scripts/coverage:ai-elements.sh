#!/bin/bash
# AI Elements Coverage Script
# Reports on registered components vs used components

set -e

echo "=============================================="
echo "AI Elements Coverage Report"
echo "=============================================="
echo ""

REGISTRY_FILE="src/components/ai-elements/registry.ts"

# Extract component IDs from registry (lines like: id: "component-name",)
COMPONENT_IDS=$(grep -E '^\s+id:\s*"' "$REGISTRY_FILE" | sed 's/.*id: "\([^"]*\)".*/\1/')
REGISTRY_COUNT=$(echo "$COMPONENT_IDS" | wc -l | tr -d ' ')

echo "📊 Registry Statistics:"
echo "  Total registered: $REGISTRY_COUNT"

# Count by category
echo ""
echo "📁 By Category:"
grep -E '^\s+category:\s*"' "$REGISTRY_FILE" | sed 's/.*category: "\([^"]*\)".*/\1/' | sort | uniq -c | while read count category; do
  echo "  $category: $count"
done

echo ""
echo "🔍 Checking imports in production code..."

# Find production views (excluding test files and ElementsLab)
PRODUCTION_FILES=$(find src/views src/shell -name "*.tsx" -not -name "*.test.tsx" -not -name "ElementsLab.tsx" 2>/dev/null)

if [ -z "$PRODUCTION_FILES" ]; then
  echo "  No production files found"
  exit 0
fi

echo ""
echo "✅ Components used in production views:"
USED_COUNT=0
UNUSED_IDS=""

for component_id in $COMPONENT_IDS; do
  # Convert kebab-case to PascalCase for component matching
  # e.g., "prompt-input" -> "PromptInput"
  PASCAL_NAME=$(echo "$component_id" | sed -E 's/-(.)/\U\1/g' | sed -E 's/^(.)/\U\1/')
  
  # Check for imports or usage in production files
  FOUND=0
  for file in $PRODUCTION_FILES; do
    if grep -qE "(import.*$PASCAL_NAME|import.*$component_id|from.*ai-elements.*$component_id)" "$file" 2>/dev/null; then
      FOUND=1
      break
    fi
  done
  
  if [ "$FOUND" -eq 1 ]; then
    echo "  ✓ $component_id"
    USED_COUNT=$((USED_COUNT + 1))
  else
    UNUSED_IDS="$UNUSED_IDS $component_id"
  fi
done

echo ""
echo "⚠️  Components NOT used in production (Elements Lab only):"
if [ -z "$UNUSED_IDS" ]; then
  echo "  (none - all components are used!)"
  UNUSED_COUNT=0
else
  for id in $UNUSED_IDS; do
    echo "  - $id"
  done
  UNUSED_COUNT=$(echo "$UNUSED_IDS" | wc -w | tr -d ' ')
fi

echo ""
echo "=============================================="
echo "📈 Coverage Summary:"
echo "  Total: $REGISTRY_COUNT"
echo "  Used: $USED_COUNT"
echo "  Unused: $UNUSED_COUNT"
if [ "$REGISTRY_COUNT" -gt 0 ]; then
  COVERAGE=$((USED_COUNT * 100 / REGISTRY_COUNT))
  echo "  Coverage: ${COVERAGE}%"
fi
echo "=============================================="

# Exit with error if coverage is too low and --fail flag is provided
if [ "$1" = "--fail" ] && [ "$COVERAGE" -lt 80 ]; then
  echo ""
  echo "❌ Coverage below 80% threshold"
  exit 1
fi
