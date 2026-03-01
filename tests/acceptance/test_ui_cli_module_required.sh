#!/bin/bash
set -euo pipefail

echo "Testing UI CLI module required..."

if [ ! -f "./apps/ui/src/pages/CLIModuleUI.tsx" ]; then
    echo "FAIL: CLIModuleUI.tsx missing"
    exit 1
fi

echo "OK: CLI module UI exists"