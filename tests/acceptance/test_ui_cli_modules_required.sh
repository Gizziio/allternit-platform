#!/bin/bash
set -euo pipefail

echo "Testing UI CLI modules required..."

if [ ! -f "./apps/ui/src/pages/CLIModuleUI.tsx" ]; then
    echo "FAIL: CLIModuleUI.tsx missing"
    exit 1
fi

echo "OK: CLI modules UI exists"