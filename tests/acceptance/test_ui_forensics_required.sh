#!/bin/bash
set -euo pipefail

echo "Testing UI forensics required..."

if [ ! -f "./apps/ui/src/pages/ForensicsExportUI.tsx" ]; then
    echo "FAIL: ForensicsExportUI.tsx missing"
    exit 1
fi

echo "OK: Forensics UI exists"