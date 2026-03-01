#!/bin/bash
set -euo pipefail

echo "Testing UI capsules explorer required..."

if [ ! -f "./apps/ui/src/pages/CapsulesExplorer.tsx" ]; then
    echo "FAIL: CapsulesExplorer.tsx missing"
    exit 1
fi

echo "OK: Capsules explorer UI exists"