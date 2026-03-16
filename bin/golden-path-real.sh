#!/bin/bash
# Golden Path Test - Real Canvas Module Creation

export CANVAS_BASE_URL="https://canvas.instructure.com"
export CANVAS_API_TOKEN="7~xG8tXkuEFa4fQ7zykECKhmKNuWVw9Feh84BGaeL92xP4nGxVJ8wQ89rEFZvH4uEr"
export COURSE_ID="14389375"

echo "=== A2R Golden Path Test - REAL CANVAS EXECUTION ==="
echo ""
echo "Course ID: $COURSE_ID"
echo ""

# Start the operator daemon
echo "Starting A2R Operator daemon..."
pkill -f operator-daemon.js 2>/dev/null || true
sleep 1

cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/1-kernel/agent-systems/a2r-dak-runner
nohup node dist/operator-daemon.js --port 3010 > /tmp/operator.log 2>&1 &
sleep 3

# Check daemon is running
if curl -s http://127.0.0.1:3010/health > /dev/null 2>&1; then
    echo "✅ Operator daemon running"
else
    echo "❌ Operator daemon failed to start"
    exit 1
fi

echo ""
echo "Submitting request to create Canvas module..."
echo ""

# Submit request
RESPONSE=$(curl -s -X POST http://127.0.0.1:3010/work/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"real_canvas_test\",
    \"intent\": \"Create module Week 1 AI Basics\",
    \"mode\": \"plan_then_execute\",
    \"context\": {
      \"target_type\": \"browser\",
      \"target_domain\": \"canvas.instructure.com\",
      \"target_context\": {
        \"course_id\": \"$COURSE_ID\"
      }
    },
    \"preferences\": {
      \"prefer_connector\": true,
      \"allow_browser_automation\": true
    },
    \"policy\": {
      \"require_private_model\": false
    }
  }")

echo "Response:"
echo "$RESPONSE" | jq .

echo ""
echo "Waiting for execution..."
sleep 3

echo ""
echo "Checking receipts..."
RECEIPTS=$(curl -s http://127.0.0.1:3010/receipts)
echo "$RECEIPTS" | jq '.receipts[0]'

echo ""
echo "Verifying module in Canvas..."
curl -s "$CANVAS_BASE_URL/api/v1/courses/$COURSE_ID/modules" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq '.[] | select(.name | contains("Week 1")) | {name: .name, id: .id, position: .position}'

echo ""
echo "=== Test Complete ==="
echo ""
echo "Check your Canvas course to see the new module:"
echo "$CANVAS_BASE_URL/courses/$COURSE_ID/modules"
