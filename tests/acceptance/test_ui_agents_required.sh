#!/bin/bash
set -euo pipefail

echo "Testing UI agents required..."

if [ ! -f "./apps/ui/src/pages/AgentConsole.tsx" ]; then
    echo "FAIL: AgentConsole.tsx missing"
    exit 1
fi

echo "OK: Agents UI exists"