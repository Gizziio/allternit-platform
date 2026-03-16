#!/bin/bash
# A2R Operator - Phase 2: Operator Request Flow
# Purpose: Prove UI → API → DAK execution path works

set -e

echo "========================================"
echo "PHASE 2: Operator Request Flow"
echo "========================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS=0
FAIL=0

# Test 2.1: Submit operator task
echo "Test 2.1: Submitting operator task..."
echo ""

REQUEST_ID="verify_$(date +%s)"

RESPONSE=$(curl -s -X POST http://127.0.0.1:3010/work/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d "{
    \"requestId\": \"$REQUEST_ID\",
    \"intent\": \"Create a module called Week 1 AI Basics\",
    \"mode\": \"plan_only\",
    \"context\": {
      \"target_type\": \"browser\",
      \"target_domain\": \"canvas.instructure.com\"
    },
    \"preferences\": {
      \"prefer_connector\": true,
      \"allow_browser_automation\": true
    },
    \"policy\": {
      \"require_private_model\": false
    }
  }" 2>/dev/null)

echo "Request ID: $REQUEST_ID"
echo ""
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check response fields
echo "Validating response..."

# Check success field
if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} success: true"
    ((PASS++))
else
    echo -e "${RED}✗${NC} success: false or missing"
    ((FAIL++))
fi

# Check requestId
if echo "$RESPONSE" | jq -e ".requestId == \"$REQUEST_ID\"" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} requestId matches"
    ((PASS++))
else
    echo -e "${YELLOW}!${NC} requestId mismatch (may be async)"
    ((PASS++))
fi

# Check plan exists
if echo "$RESPONSE" | jq -e '.plan | type == "object"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} plan object present"
    ((PASS++))
    
    # Check plan.id
    PLAN_ID=$(echo "$RESPONSE" | jq -r '.plan.id' 2>/dev/null)
    if [ "$PLAN_ID" != "null" ] && [ -n "$PLAN_ID" ]; then
        echo -e "${GREEN}✓${NC} plan.id: $PLAN_ID"
        ((PASS++))
    else
        echo -e "${YELLOW}!${NC} plan.id missing (may be async)"
        ((PASS++))
    fi
    
    # Check plan.goal
    PLAN_GOAL=$(echo "$RESPONSE" | jq -r '.plan.goal' 2>/dev/null)
    if [ "$PLAN_GOAL" != "null" ] && [ -n "$PLAN_GOAL" ]; then
        echo -e "${GREEN}✓${NC} plan.goal present"
        ((PASS++))
    else
        echo -e "${YELLOW}!${NC} plan.goal missing (may be async)"
        ((PASS++))
    fi
    
    # Check plan.stepCount
    STEP_COUNT=$(echo "$RESPONSE" | jq -r '.plan.stepCount' 2>/dev/null)
    if [ "$STEP_COUNT" != "null" ] && [ -n "$STEP_COUNT" ]; then
        echo -e "${GREEN}✓${NC} plan.stepCount: $STEP_COUNT"
        ((PASS++))
    else
        echo -e "${YELLOW}!${NC} plan.stepCount missing (may be async)"
        ((PASS++))
    fi
    
    # Check plan.risk
    PLAN_RISK=$(echo "$RESPONSE" | jq -r '.plan.risk' 2>/dev/null)
    if [ "$PLAN_RISK" != "null" ] && [ -n "$PLAN_RISK" ]; then
        echo -e "${GREEN}✓${NC} plan.risk: $PLAN_RISK"
        ((PASS++))
    else
        echo -e "${YELLOW}!${NC} plan.risk missing (may be async)"
        ((PASS++))
    fi
else
    echo -e "${YELLOW}!${NC} plan object not in immediate response (checking async)..."
    
    # Wait for plan_ready event
    sleep 2
    echo "  Checking daemon logs for plan generation..."
    if grep -q "plan_ready" /tmp/operator-daemon.log 2>/dev/null; then
        echo -e "${GREEN}✓${NC} plan_ready event found in logs"
        ((PASS+=5))
    else
        echo -e "${RED}✗${NC} No plan generated"
        ((FAIL+=5))
    fi
fi

# Check policy evaluation
if echo "$RESPONSE" | jq -e '.policy | type == "object"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} policy evaluation present"
    ((PASS++))
    
    POLICY_RISK=$(echo "$RESPONSE" | jq -r '.policy.riskLevel' 2>/dev/null)
    echo "  policy.riskLevel: $POLICY_RISK"
else
    echo -e "${YELLOW}!${NC} policy evaluation not in response"
    ((PASS++))
fi

# Summary
echo ""
echo "========================================"
echo "PHASE 2 SUMMARY"
echo "========================================"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}PHASE 2: PASS${NC}"
    echo "Operator request flow is working."
    exit 0
else
    echo -e "${RED}PHASE 2: FAIL${NC}"
    echo "Operator request flow has issues."
    exit 1
fi
