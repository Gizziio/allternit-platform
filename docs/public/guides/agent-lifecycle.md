# Agent Lifecycle Guide

This guide walks through the end-to-end flow for running a managed agent on the Allternit API: create an agent, open a session, stream events, interrupt the run, and deploy the agent on a cron schedule.

> Base URL: `http://localhost:8013/api/v1`  
> Auth: `Authorization: Bearer <clerk_jwt>`

---

## 1. Create an agent

`POST /agents`

A minimal agent needs a `name`, `agent_type`, `model`, and `provider`. The agent checklist validation requires a name of at least 3 characters, a description of at least 10 characters, and a `harness_config.mode` of `byok`, `cloud`, `local`, or `subprocess`.

```bash
curl -X POST http://localhost:8013/api/v1/agents \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-agent",
    "description": "Triages support tickets and suggests replies.",
    "agent_type": "worker",
    "model": "claude-sonnet-4",
    "provider": "anthropic",
    "system_prompt": "You are a helpful support engineer. Be concise.",
    "harness_config": {"mode": "local"},
    "enabled_modes": ["chat"]
  }'
```

Save the returned `id` as `AGENT_ID`.

---

## 2. Create a session

`POST /beta/sessions`

Bind the new agent to a managed session with a budget.

```bash
export AGENT_ID="agent_01J3X8X8X8X8X8X8X8X8X8X8"

SESSION=$(curl -s -X POST http://localhost:8013/api/v1/beta/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"name\": \"ticket-triage-7\",
    \"budget\": {
      \"max_tokens\": 10000,
      \"max_turns\": 20,
      \"max_tool_calls\": 50
    },
    \"metadata\": {\"ticket_id\": \"T-1234\"}
  }")

export SESSION_ID=$(echo "$SESSION" | jq -r '.session.id')
echo "Session: $SESSION_ID"
```

The platform seeds two system events: `session_created` and `budget_updated`.

---

## 3. Stream events

`GET /beta/sessions/:id/events`

Open an SSE connection and listen for run progress. In another terminal, append run events as the agent runtime produces them.

```bash
curl -N "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID/events" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Accept: text/event-stream"
```

### Append a run event

`POST /beta/sessions/:id/events`

```bash
curl -X POST "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID/events" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "content_block_delta",
    "data": {"message": "Ticket T-1234 is a billing question. Routing to billing team."},
    "usage": {"tokens": 24, "turns": 1, "tool_calls": 0}
  }'
```

Appendable run event types are `thinking_delta`, `content_block_delta`, `tool_calls`, and `refusal`.

---

## 4. Interrupt the session

`POST /beta/sessions/:id/interrupt`

If a human operator or parent orchestrator needs to stop the run, send an interrupt.

```bash
curl -X POST "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID/interrupt" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"data": {"reason": "user_pressed_stop"}}'
```

This appends a `user_interrupt` event to the stream. Archived sessions cannot be interrupted.

---

## 5. Deploy on a cron schedule

`POST /beta/deployments`

Schedule the agent to run every morning at 09:00 UTC.

```bash
DEPLOYMENT=$(curl -s -X POST http://localhost:8013/api/v1/beta/deployments \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"$AGENT_ID\",
    \"cron\": \"0 9 * * *\",
    \"metadata\": {\"team\": \"support\"}
  }")

export DEPLOYMENT_ID=$(echo "$DEPLOYMENT" | jq -r '.deployment.id')
echo "Deployment: $DEPLOYMENT_ID"
```

### Trigger a run manually

`POST /beta/deployments/:id/runs`

```bash
curl -X POST "http://localhost:8013/api/v1/beta/deployments/$DEPLOYMENT_ID/runs" \
  -H "Authorization: Bearer $CLERK_JWT"
```

### Report run completion

`PATCH /beta/deployments/:id/runs/:run_id`

```bash
export RUN_ID="run_01J3X8X8X8X8X8X8X8X8X8X8"
curl -X PATCH "http://localhost:8013/api/v1/beta/deployments/$DEPLOYMENT_ID/runs/$RUN_ID" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "succeeded", "result": {"tickets_triaged": 12}}'
```

---

## 6. Archive the session

When the run is finished, archive the session to release its active budget slot.

```bash
curl -X DELETE "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CLERK_JWT"
```

---

## Full lifecycle script

```bash
#!/usr/bin/env bash
set -euo pipefail

export CLERK_JWT="your_token"
export API="http://localhost:8013/api/v1"

AGENT_ID=$(curl -s -X POST "$API/agents" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-agent",
    "description": "Triages support tickets and suggests replies.",
    "agent_type": "worker",
    "model": "claude-sonnet-4",
    "provider": "anthropic",
    "harness_config": {"mode": "local"}
  }' | jq -r '.agent.id')

SESSION_ID=$(curl -s -X POST "$API/beta/sessions" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"$AGENT_ID\",\"name\":\"ticket-triage\",\"budget\":{\"max_tokens\":10000,\"max_turns\":20,\"max_tool_calls\":50}}" \
  | jq -r '.session.id')

curl -s -X POST "$API/beta/sessions/$SESSION_ID/events" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"type":"content_block_delta","data":{"message":"Triaging..."},"usage":{"tokens":10,"turns":1,"tool_calls":0}}'

curl -s -X POST "$API/beta/sessions/$SESSION_ID/interrupt" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"data":{"reason":"demo_done"}}'

curl -s -X DELETE "$API/beta/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $CLERK_JWT"

echo "Lifecycle complete. Agent: $AGENT_ID, Session: $SESSION_ID"
```
