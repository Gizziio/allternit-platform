#!/bin/bash
# Test Canvas API Connection

if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_API_TOKEN" ]; then
    echo "❌ Canvas credentials not set!"
    echo ""
    echo "Run these commands:"
    echo "  export CANVAS_BASE_URL=https://canvas.instructure.com"
    echo "  export CANVAS_API_TOKEN=your_token_here"
    exit 1
fi

echo "Testing Canvas API connection..."
echo "URL: $CANVAS_BASE_URL"
echo ""

# Test connection by getting current user
RESPONSE=$(curl -s -w "\n%{http_code}" "$CANVAS_BASE_URL/api/v1/users/self" \
  -H "Authorization: Bearer $CANVAS_API_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Canvas API connection successful!"
    echo ""
    echo "User info:"
    echo "$BODY" | jq -r '"Name: \(.name)\nEmail: \(.email)\nID: \(.id)"'
    
    # Get courses
    echo ""
    echo "Fetching courses..."
    COURSES=$(curl -s "$CANVAS_BASE_URL/api/v1/courses" \
      -H "Authorization: Bearer $CANVAS_API_TOKEN")
    
    echo ""
    echo "Your courses:"
    echo "$COURSES" | jq -r '.[] | "  - \(.name) (ID: \(.id))"' 2>/dev/null || echo "  (no courses found)"
    
    echo ""
    echo "✅ Canvas is ready for Allternit Operator!"
    echo ""
    echo "To create a test course, go to: $CANVAS_BASE_URL"
    echo "Then run the golden path test."
    
    exit 0
else
    echo "❌ Canvas API connection failed!"
    echo ""
    echo "HTTP Status: $HTTP_CODE"
    echo "Response: $BODY"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check your API token is correct"
    echo "  2. Make sure your Canvas URL is correct"
    echo "  3. Ensure the token hasn't expired"
    exit 1
fi
