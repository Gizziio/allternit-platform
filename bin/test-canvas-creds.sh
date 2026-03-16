#!/bin/bash
# Test Canvas API with provided credentials

export CANVAS_BASE_URL="https://canvas.instructure.com"
export CANVAS_API_TOKEN="7~xG8tXkuEFa4fQ7zykECKhmKNuWVw9Feh84BGaeL92xP4nGxVJ8wQ89rEFZvH4uEr"

echo "=== Canvas API Test ==="
echo ""
echo "Base URL: $CANVAS_BASE_URL"
echo "Token: ${CANVAS_API_TOKEN:0:20}... (truncated)"
echo ""
echo "Testing user endpoint..."
curl -s "$CANVAS_BASE_URL/api/v1/users/self" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq .

echo ""
echo "Fetching your courses..."
curl -s "$CANVAS_BASE_URL/api/v1/courses?per_page=10" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN" | jq '.[] | {name: .name, id: .id}'
