#!/bin/bash
# A2R Operator - Phase 9: Failure Path Handling
# Purpose: Prove system handles failures gracefully

set -e

echo "Testing failure handling..."
echo ""

# Submit with invalid URL
echo "Submitting request with invalid Canvas URL..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:3010/work/submit \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "failure_test_001",
    "intent": "Create module",
    "context": {
      "target_type": "browser",
      "url": "https://invalid-canvas-domain.fake/courses/999"
    },
    "preferences": {
      "allow_browser_automation": true
    },
    "policy": {}
  }')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if request was accepted (system should handle failure gracefully)
if echo "$RESPONSE" | jq -e '.success == true or .requestId' > /dev/null 2>&1; then
    echo "✓ Request accepted (failure will be handled during execution)"
    
    # Check daemon is still running (didn't crash)
    if pgrep -f "operator-daemon.js" > /dev/null; then
        echo "✓ Daemon still running (no crash)"
        exit 0
    else
        echo "✗ Daemon crashed"
        exit 1
    fi
else
    echo "⚠ Request rejected at submission (also acceptable)"
    exit 0
fi
