#!/bin/bash
# Fix script for gizzi-code hanging issues
# This kills any stuck gizzi processes and cleans up state

set -e

echo "🔍 Checking for stuck gizzi processes..."

# Find and count stuck gizzi processes
COUNT=$(ps aux | grep -i 'bun.*gizzi\|gizzi.*bun\|gizzi-code' | grep -v grep | grep -v fix-hang.sh | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
    echo "⚠️  Found $COUNT stuck process(es)"
    echo "📋 Processes:"
    ps aux | grep -i 'bun.*gizzi\|gizzi.*bun\|gizzi-code' | grep -v grep | grep -v fix-hang.sh || true
    
    echo ""
    echo "🔨 Killing stuck processes..."
    pkill -9 -f "bun.*main.ts" 2>/dev/null || true
    pkill -9 -f "gizzi-code" 2>/dev/null || true
    pkill -9 -f "gizzi" 2>/dev/null || true
    
    sleep 1
    
    REMAINING=$(ps aux | grep -i 'bun.*gizzi\|gizzi.*bun\|gizzi-code' | grep -v grep | grep -v fix-hang.sh | wc -l | tr -d ' ')
    if [ "$REMAINING" -eq 0 ]; then
        echo "✅ All stuck processes killed"
    else
        echo "⚠️  Warning: $REMAINING process(es) still running"
    fi
else
    echo "✅ No stuck processes found"
fi

echo ""
echo "✨ Gizzi-code is ready to run!"
echo "   Run: bun run --conditions=browser ./src/cli/main.ts"
