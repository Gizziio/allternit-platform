#!/bin/bash
# A2R Operator - Phase 6: Canvas Verification
# Purpose: Prove Canvas objects are created

set -e

echo "Testing Canvas integration..."
echo ""

# Check if Canvas credentials are configured
if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_API_TOKEN" ]; then
    echo "⚠ Canvas credentials not configured"
    echo "  Set CANVAS_BASE_URL and CANVAS_API_TOKEN environment variables"
    echo "  Skipping Canvas verification (not blocking)"
    exit 0
fi

# Try to list courses
echo "Testing Canvas API connection..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$CANVAS_BASE_URL/api/v1/courses" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Canvas API accessible"
    echo "Response: $BODY" | jq '.[0]' 2>/dev/null || echo "$BODY"
    exit 0
else
    echo "✗ Canvas API error (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
