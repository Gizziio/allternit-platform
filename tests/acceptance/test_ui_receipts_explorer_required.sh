#!/bin/bash
set -euo pipefail

echo "Testing UI receipts explorer required..."

if [ ! -f "./apps/ui/src/pages/ReceiptsExplorer.tsx" ]; then
    echo "FAIL: ReceiptsExplorer.tsx missing"
    exit 1
fi

echo "OK: Receipts explorer UI exists"