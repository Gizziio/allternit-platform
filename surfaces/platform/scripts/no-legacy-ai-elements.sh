#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Checking for legacy ai-elements imports..."

# Fail if any non-legacy file imports from legacy path
if rg -n "src/legacy/ai-elements" src --glob '!src/legacy/**' --type ts --type tsx 2>/dev/null; then
  echo ""
  echo "ERROR: Legacy ai-elements imported from outside src/legacy/"
  echo "All imports must use: @/components/ai-elements/"
  exit 1
fi

# Fail if old components/ai-elements path is used
if rg -n "components/ai-elements" src --type ts --type tsx 2>/dev/null; then
  echo ""
  echo "ERROR: Old components/ai-elements path used"
  echo "Use: @/components/ai-elements (resolves to src/components/ai-elements)"
  exit 1
fi

# Fail if legacy directory still exists at old location
if [ -d "components/ai-elements" ]; then
  echo ""
  echo "ERROR: Legacy components/ai-elements directory still exists at root"
  echo "It should be moved to src/legacy/ai-elements/"
  exit 1
fi

echo "✅ OK: No legacy ai-elements imports found"
