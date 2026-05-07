#!/usr/bin/env bash
# Record SSE stream from /api/chat for adapter testing
# Writes raw SSE to .allternit/fixtures/chat.sse

set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${API_URL:-http://localhost:3000}"
CHAT_ID="${CHAT_ID:-test-$(date +%s)}"
MESSAGE="${MESSAGE:-Hello, what can you do?}"
MODEL_ID="${MODEL_ID:-gpt-4o}"
OUTPUT_FILE=".allternit/fixtures/chat.sse"

echo "Recording SSE from $API_URL/api/chat"
echo "Chat ID: $CHAT_ID"
echo "Message: $MESSAGE"
echo "Model: $MODEL_ID"
echo "Output: $OUTPUT_FILE"
echo ""

# Ensure fixtures directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Make the request and stream raw SSE
# Using curl with -N for no buffering
curl -N -s -X POST "$API_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatId\": \"$CHAT_ID\",
    \"message\": \"$MESSAGE\",
    \"modelId\": \"$MODEL_ID\",
    \"webSearch\": false
  }" 2>/dev/null | tee "$OUTPUT_FILE"

echo ""
echo "✅ SSE recorded to $OUTPUT_FILE"
echo "Lines captured: $(wc -l < "$OUTPUT_FILE")"
