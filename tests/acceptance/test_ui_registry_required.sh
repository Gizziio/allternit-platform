#!/bin/bash
# Test that UI registry files are present and copied during build

set -e

echo "Testing UI Registry requirements..."

# Check if registry files exist in expected locations
if [ ! -f "apps/ui/src/gateway_registry.json" ]; then
    echo "FAIL: gateway_registry.json not found in apps/ui/src/"
    exit 1
fi

if [ ! -f "apps/ui/src/ui_registry.json" ]; then
    echo "FAIL: ui_registry.json not found in apps/ui/src/"
    exit 1
fi

# Check if registry files are valid JSON
if ! jq empty "apps/ui/src/gateway_registry.json" 2>/dev/null; then
    echo "FAIL: gateway_registry.json is not valid JSON"
    exit 1
fi

if ! jq empty "apps/ui/src/ui_registry.json" 2>/dev/null; then
    echo "FAIL: ui_registry.json is not valid JSON"
    exit 1
fi

echo "PASS: UI Registry files present and valid"
exit 0