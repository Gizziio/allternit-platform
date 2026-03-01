#!/bin/bash

# Test: UI Runs Dashboard Required
# Verifies that the runs dashboard functionality exists and is accessible

set -e

echo "Testing UI Runs Dashboard requirements..."

# Check that runs dashboard component exists
if [[ ! -f "apps/ui/src/pages/RunsDashboard.tsx" ]]; then
    echo "FAIL: Runs dashboard component not found"
    exit 1
fi

# Check that runs dashboard is registered in UI registry
if ! grep -q "action-run-replay\|runs\|Runs" apps/ui/src/ui_registry.json; then
    echo "FAIL: Runs dashboard not properly registered in UI registry"
    exit 1
fi

# Check that runs dashboard is accessible via routing
if ! grep -q "RunsDashboard\|/runs" apps/ui/src/App.tsx; then
    echo "FAIL: Runs dashboard not accessible via routing"
    exit 1
fi

# Check that runs dashboard uses gateway client
if ! grep -q "gatewayClient\|fetch.*gateway" apps/ui/src/pages/RunsDashboard.tsx; then
    echo "FAIL: Runs dashboard doesn't use gateway client"
    exit 1
fi

echo "PASS: UI Runs Dashboard requirements verified"
exit 0