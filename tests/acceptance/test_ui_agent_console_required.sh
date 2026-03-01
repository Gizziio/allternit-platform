#!/bin/bash
set -euo pipefail

echo "Testing UI agent console required..."

if [ ! -f "./apps/ui/src/pages/AgentConsole.tsx" ]; then
    echo "FAIL: AgentConsole.tsx missing"
    exit 1
fi

echo "OK: Agent console UI exists"