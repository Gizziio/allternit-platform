# Sessions API

Managed, durable agent sessions. A session is a scoped context for a single agent run or a child thread of an existing run. All routes are nested under `/api/v1/beta/sessions` and require a Clerk JWT session.

> Base URL: `http://localhost:8013/api/v1`  
> Auth: `Authorization: Bearer <clerk_jwt>`

---

## Create a session

`POST /beta/sessions`

Starts a new managed session. The caller may bind it to an existing agent with `agent_id`, give it a `name`, and link it to a parent session via `parent_thread_id` to create a child thread. Budget limits are stored at the session level and enforced when run events are appended.

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_id` | string | no | Agent to run in this session. |
| `name` | string | no | Human-readable session name. |
| `parent_thread_id` | string | no | Existing session UUID to treat as the parent thread. Must belong to the same user. |
| `metadata` | object | no | Arbitrary key/value object. Defaults to `{}`. |
| `budget` | object | no | Limits for this session. See Budget object below. |

**Budget object**

| Field | Type | Description |
|-------|------|-------------|
| `max_tokens` | integer | Maximum cumulative tokens. |
| `max_turns` | integer | Maximum cumulative turns. |
| `max_tool_calls` | integer | Maximum cumulative tool calls. |

### Example

```bash
curl -X POST http://localhost:8013/api/v1/beta/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_01J3X8X8X8X8X8X8X8X8X8X8",
    "name": "support-thread-7",
    "budget": {
      "max_tokens": 10000,
      "max_turns": 20,
      "max_tool_calls": 50
    },
    "metadata": {"ticket_id": "T-1234"}
  }'
```

### Response

```json
{
  "session": {
    "id": "sess_01J3X8X8X8X8X8X8X8X8X8X8",
    "agent_id": "agent_01J3X8X8X8X8X8X8X8X8X8X8",
    "name": "support-thread-7",
    "parent_thread_id": null,
    "status": "active",
    "metadata": {"ticket_id": "T-1234"},
    "budget": {
      "max_tokens": 10000,
      "max_turns": 20,
      "max_tool_calls": 50,
      "tokens_used": 0,
      "turns_used": 0,
      "tool_calls_used": 0
    },
    "created_at": "2026-08-09T09:30:00Z",
    "updated_at": "2026-08-09T09:30:00Z",
    "archived_at": null
  },
  "id": "sess_01J3X8X8X8X8X8X8X8X8X8X8"
}
```

Creating a session also seeds two system events: `session_created` and `budget_updated`.

---

## List sessions

`GET /beta/sessions[?status=active|archived][&parent_thread_id=<id>]`

Returns the caller's sessions, newest first. Filter by `status` or `parent_thread_id` to list child threads.

### Example

```bash
curl "http://localhost:8013/api/v1/beta/sessions?status=active" \
  -H "Authorization: Bearer $CLERK_JWT"
```

### Response

```json
{
  "sessions": [
    {
      "id": "sess_01J3X8X8X8X8X8X8X8X8X8X8",
      "agent_id": "agent_01J3X8X8X8X8X8X8X8X8X8X8",
      "name": "support-thread-7",
      "parent_thread_id": null,
      "status": "active",
      "metadata": {"ticket_id": "T-1234"},
      "budget": {
        "max_tokens": 10000,
        "max_turns": 20,
        "max_tool_calls": 50,
        "tokens_used": 0,
        "turns_used": 0,
        "tool_calls_used": 0
      },
      "created_at": "2026-08-09T09:30:00Z",
      "updated_at": "2026-08-09T09:30:00Z",
      "archived_at": null
    }
  ]
}
```

---

## Get a session

`GET /beta/sessions/:id`

### Example

```bash
curl http://localhost:8013/api/v1/beta/sessions/sess_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT"
```

---

## Update a session

`PATCH /beta/sessions/:id`

Only the fields provided are updated. Updating `budget` overwrites the stored limits and emits a new `budget_updated` event.

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New session name. |
| `metadata` | object | no | Replaces the existing metadata object. |
| `budget` | object | no | Replaces the existing budget limits. |

### Example

```bash
curl -X PATCH http://localhost:8013/api/v1/beta/sessions/sess_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-thread-7-renamed",
    "budget": {"max_tokens": 20000, "max_turns": 40, "max_tool_calls": 100}
  }'
```

---

## Archive a session

`DELETE /beta/sessions/:id`

Archives the session (status becomes `archived` and `archived_at` is set). Archived sessions cannot receive new events or be interrupted. This is a soft delete; the record and event history remain available.

### Example

```bash
curl -X DELETE http://localhost:8013/api/v1/beta/sessions/sess_01J3X8X8X8X8X8X8X8X8X8X8 \
  -H "Authorization: Bearer $CLERK_JWT"
```

### Response

```json
{"archived": true}
```

---

## Session resources

Credentials and references can be attached to a session so the agent can use them without embedding secrets in prompts.

Supported resource kinds:

| Kind | Storage |
|------|---------|
| `github_token` | Encrypted at rest. |
| `vault_credential` | Stored as a reference (`ref`). |
| `api_key` | Encrypted at rest. |

See the full resource endpoints below.

### Attach a resource

`POST /beta/sessions/:id/resources`

Provide exactly one of `value` (encrypted) or `ref` (external reference).

```bash
curl -X POST http://localhost:8013/api/v1/beta/sessions/sess_01J3X8X8X8X8X8X8X8X8X8X8/resources \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github",
    "kind": "github_token",
    "value": "ghp_..."
  }'
```

### List resources

`GET /beta/sessions/:id/resources`

### Delete a resource

`DELETE /beta/sessions/:id/resources/:resource_id`

---

## Status codes

| Status | Meaning |
|--------|---------|
| 201 | Session or resource created. |
| 200 | List/get/update succeeded. |
| 204 | Resource deleted. |
| 400 | Missing/invalid field, or `parent_thread_id` does not exist. |
| 404 | Session or resource not found, or not owned by the caller. |
| 409 | Duplicate resource name for the session. |
