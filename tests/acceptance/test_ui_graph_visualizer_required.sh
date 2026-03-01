#!/bin/bash

# Test: UI Graph Visualizer Required
# Verifies that the graph visualizer functionality exists and is accessible

set -e

echo "Testing UI Graph Visualizer requirements..."

# Check that graph visualizer component exists
if [[ ! -f "apps/ui/src/pages/GraphVisualizer.tsx" ]]; then
    echo "FAIL: Graph visualizer component not found"
    exit 1
fi

# Check that graph visualizer is accessible via routing
if ! grep -q "GraphVisualizer\|/graphs" apps/ui/src/App.tsx; then
    echo "FAIL: Graph visualizer not accessible via routing"
    exit 1
fi

# Check that graph visualizer uses gateway client
if ! grep -q "gatewayClient\|useGraph" apps/ui/src/pages/GraphVisualizer.tsx; then
    echo "FAIL: Graph visualizer doesn't use gateway client or useGraph hook"
    exit 1
fi

# Check that no forbidden patterns exist in the component
if grep -q "localhost\|127\.0\.0\.1\|:3000\|:8080\|:3001\|:3002\|:3003\|:3004\|:3005\|:3006\|:3007\|:3008\|:3009\|:4000\|:5000\|:8000\|:9000" apps/ui/src/pages/GraphVisualizer.tsx; then
    echo "FAIL: Graph visualizer contains forbidden localhost/port patterns"
    exit 1
fi

if grep -q "services/kernel\|/kernel\|kernel:" apps/ui/src/pages/GraphVisualizer.tsx; then
    echo "FAIL: Graph visualizer contains forbidden kernel references"
    exit 1
fi

if grep -q "ToolRegistry\|tool_registry\|shell\.execute" apps/ui/src/pages/GraphVisualizer.tsx; then
    echo "FAIL: Graph visualizer contains forbidden tool registry references"
    exit 1
fi

echo "PASS: UI Graph Visualizer requirements verified"
exit 0