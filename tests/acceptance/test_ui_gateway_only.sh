#!/bin/bash
# Test that UI does not make direct kernel calls or use ports/hosts

set -e

echo "Testing UI Gateway Only compliance..."

UI_SRC_DIR="apps/ui/src"

# Check for forbidden patterns
echo "Checking for forbidden patterns in UI source..."

# Check for localhost, direct IPs, ports
if grep -r -E "localhost|127\.0\.0\.1|:[0-9]{2,5}" "$UI_SRC_DIR" --include="*.ts" --include="*.tsx" --include="*.js" | grep -v "gateway_registry.json\|ui_registry.json" ; then
    echo "FAIL: Found forbidden host/port patterns in UI source"
    exit 1
fi

# Check for direct kernel calls
if grep -r -E "services/kernel|/kernel|kernel:" "$UI_SRC_DIR" --include="*.ts" --include="*.tsx" --include="*.js"; then
    echo "FAIL: Found direct kernel references in UI source"
    exit 1
fi

# Check for tool registry references
if grep -r -i -E "ToolRegistry|tool_registry|shell\.execute" "$UI_SRC_DIR" --include="*.ts" --include="*.tsx" --include="*.js"; then
    echo "FAIL: Found tool registry references in UI source"
    exit 1
fi

echo "PASS: UI Gateway Only compliance verified"
exit 0