#!/bin/bash
set -euo pipefail

echo "Testing UI gateway routes required..."

if [ ! -f "./apps/ui/src/pages/GatewayRoutesPanel.tsx" ]; then
    echo "FAIL: GatewayRoutesPanel.tsx missing"
    exit 1
fi

echo "OK: Gateway routes UI exists"