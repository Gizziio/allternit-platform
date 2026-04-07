#!/bin/bash

# Progress tracking script for Claude + Gizzi integration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  Integration Progress Tracker"
echo "========================================"
echo ""

# Get current error count
echo "Analyzing TypeScript errors..."
TOTAL_ERRORS=$(bun tsc --noEmit 2>&1 | grep -c "^src/" || echo "0")
SRC_ERRORS=$(bun tsc --noEmit 2>&1 | grep "^src/" | wc -l)

echo "Current Error Count: $SRC_ERRORS"
echo ""

# Error breakdown by type
echo "=== Error Breakdown ==="
bun tsc --noEmit 2>&1 | grep "^src/" | grep -oE "error TS[0-9]+" | sort | uniq -c | sort -rn | head -10
echo ""

# Top missing files
echo "=== Top 10 Missing Files ==="
bun tsc --noEmit 2>&1 | grep "^src/" | grep "TS2307" | sed 's/.*Cannot find module //' | sed "s/'.*//" | sort | uniq -c | sort -rn | head -10
echo ""

# Progress by directory
echo "=== Errors by Directory ==="
bun tsc --noEmit 2>&1 | grep "^src/" | cut -d'/' -f1-3 | sort | uniq -c | sort -rn | head -10
echo ""

# Save to log
LOG_FILE="progress_log.txt"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Errors: $SRC_ERRORS" >> "$LOG_FILE"

echo "Progress logged to $LOG_FILE"
echo "Run this script regularly to track progress."
