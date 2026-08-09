# Token, Turn, and Tool Budgets

Managed beta sessions enforce three independent budget counters: `tokens`, `turns`, and `tool_calls`. Budgets are checked when a caller appends a run event; events that would exceed a limit are rejected and a `budget_exceeded` event is recorded instead.

> Base URL: `http://localhost:8013/api/v1`  
> Auth: `Authorization: Bearer <clerk_jwt>`

---

## Budget fields

Each session stores the following budget state:

| Field | Meaning |
|-------|---------|
| `max_tokens` | Upper bound on cumulative tokens for the session. `null` means unlimited. |
| `max_turns` | Upper bound on cumulative turns. `null` means unlimited. |
| `max_tool_calls` | Upper bound on cumulative tool calls. `null` means unlimited. |
| `tokens_used` | Tokens consumed so far. |
| `turns_used` | Turns consumed so far. |
| `tool_calls_used` | Tool calls made so far. |

The counters are updated only when an appendable run event is accepted. A rejected event does not increment usage.

---

## Setting budgets

Set limits at session creation:

```bash
curl -X POST http://localhost:8013/api/v1/beta/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_01J3X8X8X8X8X8X8X8X8X8X8",
    "name": "budgeted-run",
    "budget": {
      "max_tokens": 10000,
      "max_turns": 20,
      "max_tool_calls": 50
    }
  }'
```

Update limits later with `PATCH /beta/sessions/:id`. Updating the budget emits a new `budget_updated` event but does not reset `*_used` counters.

```bash
curl -X PATCH http://localhost:8013/api/v1/beta/sessions/sess_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"budget": {"max_tokens": 20000, "max_turns": 40, "max_tool_calls": 100}}'
```

---

## Appending usage

Every run event append carries a `usage` delta:

```json
{
  "type": "content_block_delta",
  "data": {"message": "Looking up the ticket..."},
  "usage": {"tokens": 12, "turns": 0, "tool_calls": 0}
}
```

The server checks whether `tokens_used + tokens`, `turns_used + turns`, or `tool_calls_used + tool_calls` would exceed the corresponding limit. The first exceeded resource wins.

---

## Budget exceeded event

If a limit is exceeded, the append is not accepted and the platform writes a `budget_exceeded` event:

```json
{
  "accepted": false,
  "event": {
    "id": "evt_01J3X8X8X8X8X8X8X8X8X8X8",
    "sequence": 5,
    "session_id": "sess_01J3X8X8X8X8X8X8X8X8X8X8",
    "type": "budget_exceeded",
    "data": {
      "resource": "tokens",
      "usage": {"tokens": 1200, "turns": 0, "tool_calls": 0},
      "budget": {
        "max_tokens": 10000,
        "max_turns": 20,
        "max_tool_calls": 50,
        "tokens_used": 9800,
        "turns_used": 3,
        "tool_calls_used": 7
      }
    }
  }
}
```

After a budget is exceeded, the session remains active but no further usage can be recorded. The caller should either raise the budget or archive the session.

---

## Example: enforcing a tool-call ceiling

A session that may call tools at most 5 times:

```bash
export SESSION_ID="sess_01J3X8X8X8X8X8X8X8X8X8X8"

# 1. tool call
curl -X POST "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID/events" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"type":"tool_calls","data":{"calls":[]},"usage":{"tokens":0,"turns":0,"tool_calls":1}}'

# ... repeat until the 6th call is rejected
curl -X POST "http://localhost:8013/api/v1/beta/sessions/$SESSION_ID/events" \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{"type":"tool_calls","data":{"calls":[]},"usage":{"tokens":0,"turns":0,"tool_calls":1}}'
```

When `tool_calls_used` reaches `max_tool_calls`, the next append returns `accepted: false` and a `budget_exceeded` event with `resource: "tool_calls"`.

---

## Budget event types

| Event | Meaning |
|-------|---------|
| `budget_updated` | Limits were set or changed. Emitted on create and on `PATCH`. |
| `budget_exceeded` | A usage delta would have crossed a limit. |

---

## Status codes

| Status | Meaning |
|--------|---------|
| 200 | Event accepted, usage applied. |
| 200 | Event rejected, `budget_exceeded` event returned (`accepted: false`). |
| 400 | Unsupported event type or session is archived. |
| 404 | Session not found or not owned by caller. |
