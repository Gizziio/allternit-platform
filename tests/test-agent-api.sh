#!/bin/bash
# Test script to verify agent API endpoints

API_BASE="http://localhost:3000/api/v1"

echo "=== Testing Agent Session API ==="
echo ""

echo "1. Testing GET /agent-sessions (list all sessions)"
curl -s "$API_BASE/agent-sessions" | jq '.' || echo "Failed to connect"
echo ""

echo "2. Testing POST /agent-sessions (create session with metadata)"
curl -s -X POST "$API_BASE/agent-sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent Session",
    "description": "Testing backend contracts",
    "origin_surface": "chat",
    "session_mode": "agent",
    "agent_id": "test-agent-123",
    "agent_name": "Test Agent",
    "agent_features": {
      "workspace": true,
      "tools": true,
      "automation": false
    }
  }' | jq '.' || echo "Failed to create session"
echo ""

echo "3. Testing GET /registry/agents (list agents)"
curl -s "$API_BASE/registry/agents" | jq '.' || echo "Failed to list agents"
echo ""

echo "=== Done ==="
