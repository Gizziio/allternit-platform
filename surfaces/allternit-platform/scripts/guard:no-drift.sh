#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Running drift guard checks..."

# 1. Check for legacy ai-elements imports
echo "→ Checking for legacy imports..."
if rg -n "from.*legacy/ai-elements|import.*legacy/ai-elements" src --glob '!src/legacy/**' --type ts --type tsx 2>/dev/null; then
  echo "❌ FAIL: Legacy ai-elements imports found"
  exit 1
fi

# 2. Check for old tool-invocation type in adapter
echo "→ Checking for deprecated 'tool-invocation' type..."
if rg -n "type.*tool-invocation|\"tool-invocation\"" src/lib/ai/rust-stream-adapter.ts 2>/dev/null; then
  echo "❌ FAIL: Deprecated 'tool-invocation' type found. Use 'dynamic-tool' instead."
  exit 1
fi

# 3. Check for 'as any' in adapter
if rg -n "as any" src/lib/ai/rust-stream-adapter.ts 2>/dev/null; then
  echo "❌ FAIL: 'as any' found in rust-stream-adapter.ts"
  exit 1
fi

# 4. Check for @ts-ignore in adapter
if rg -n "@ts-ignore" src/lib/ai/rust-stream-adapter.ts 2>/dev/null; then
  echo "❌ FAIL: '@ts-ignore' found in rust-stream-adapter.ts"
  exit 1
fi

# 5. Check for @eslint-disable in adapter
if rg -n "@eslint-disable" src/lib/ai/rust-stream-adapter.ts 2>/dev/null; then
  echo "❌ FAIL: '@eslint-disable' found in rust-stream-adapter.ts"
  exit 1
fi

echo ""
echo "✅ All drift guard checks passed!"
