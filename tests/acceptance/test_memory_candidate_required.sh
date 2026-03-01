#!/bin/bash
set -euo pipefail

echo "Testing memory candidate required..."

if [ ! -f "./apps/ui/src/pages/MemoryPromotionUI.tsx" ]; then
    echo "FAIL: MemoryPromotionUI.tsx missing"
    exit 1
fi

echo "OK: Memory candidate UI exists"