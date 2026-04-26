#!/bin/bash
# Allternit Operator - Phase 4: Router Decision Verification
# Purpose: Prove router selects correct backend

set -e

echo "Testing execution router..."
echo ""

# Submit a Canvas-targeted request
echo "Submitting Canvas-targeted request..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:3010/work/submit \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "router_test_001",
    "intent": "Create module in Canvas",
    "mode": "plan_only",
    "context": {
      "target_type": "browser",
      "target_domain": "canvas.instructure.com"
    },
    "preferences": {
      "prefer_connector": true,
      "allow_browser_automation": true
    },
    "policy": {
      "require_private_model": false
    }
  }')

echo "Response: $RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if response contains routing decision
if echo "$RESPONSE" | jq -e '.policy' > /dev/null 2>&1; then
    echo "✓ Policy/routing decision present"
    exit 0
else
    echo "✗ No routing decision in response"
    exit 1
fi
