# Sessions API

Cloud Agent sessions. A session is a scoped context for one agent: it binds
an agent (by id or inline definition), a computer kind, and an event history
you can stream or page through. All routes are nested under `/api/v1` and
require a Clerk JWT session or API key.

> Base URL: `http://localhost:8013/api/v1`
> Auth: `Authorization: Bearer <clerk_jwt>`
> No `OpenAI-Beta` header is required.

The older `/api/v1/beta/sessions` routes remain available as an alias over
the same sessions table. New integrations should use the routes documented
here. Beta routes keep their original request/response shapes and stored
event vocabulary; this surface translates to Allternit names on read.

---

## Create a session

`POST /sessions`

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent` | string \| object | no | Existing agent id, `{ "id", "version" }` reference, or an inline agent: `{ "model", "instructions"?, "tools"?, "name"? }`. Inline agents create an `agents` row (`instructions` becomes its system prompt); the default name is `cloud-agent`. |
| `computer` | object | no | `{ "kind": "none" \| "sandbox" \| "local" }`. Default `none`. |
| `input` | string \| object | no | Initial user message: a plain string or `{ "type": "user.message", "content": "…" }`. Enqueues a run, like sending `user.message` after create. |
| `stream` | boolean | no | If true, the response is an SSE stream of the session's events (same as `GET /sessions/:id/events/stream`), starting with `session.created`, instead of a JSON session body. |
| `vault_ids` | string[] | no | Vaults to make available to the run. Recorded on session metadata. |
| `budget` | object | no | `{ "max_tokens"?, "max_turns"?, "max_tool_calls"? }`. |
| `metadata` | object | no | Arbitrary key/value object. Defaults to `{}`. |
| `brain_id` | string \| null | no | Brain attachment for the run. Recorded on session metadata. |

Computer kinds:

- `none` — no computer. The session is valid; a `computer.ready` event is
  recorded immediately.
- `sandbox` — hosted sandbox. Returns `400` unless the account has a hosted
  computer entitlement wired; it never silently becomes `none`.
- `local` — descriptor only in this release. The session records the intent
  (`computer.pending`) and accepts events, but no worker is attached and
  nothing is awaited.

### Example

```bash
curl -X POST http://localhost:8013/api/v1/sessions \
  -H "Authorization: Bearer $CLERK_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": { "model": "kimi-k2", "instructions": "Be terse." },
    "computer": { "kind": "none" },
    "input": "Summarize the repo layout."
  }'
```

### Response `201`

```json
{
  "session": {
    "id": "9f1c2a…",
    "agent_id": "3c8e…",
    "name": null,
    "status": "running",
    "metadata": {},
    "budget": {
      "max_tokens": null, "max_turns": null, "max_tool_calls": null,
      "tokens_used": 0, "turns_used": 0, "tool_calls_used": 0
    },
    "computer": { "kind": "none", "id": null },
    "created_at": "2026-09-10 12:00:00",
    "updated_at": "2026-09-10 12:00:00",
    "archived_at": null
  }
}
```

`status` is `running` while the initial input's run is queued. When the
work task is acked (`POST /beta/work/:id/ack`), the session returns to
`idle` and the event list includes `turn.completed` then `session.idle`.
With no input it is `idle`.

---

## List sessions

`GET /sessions`

Returns the caller's sessions, newest first, with public status names.

### Response `200`

```json
{ "sessions": [ { "id": "…", "status": "idle", "computer": { "kind": "none", "id": null } } ] }
```

---

## Get a session

`GET /sessions/:id`

### Response `200`

```json
{ "session": { "id": "…", "status": "idle", … } }
```

### Status values

| Status | Meaning |
|--------|---------|
| `idle` | No run in flight. |
| `running` | A run is queued or executing. |
| `waiting` | Reserved for runs blocked on input. |
| `failed` | The session failed. |
| `archived` | Terminal. Further event sends fail. |

---

## Archive a session

`POST /sessions/:id/archive`

Archiving is one-way. Subsequent `POST /sessions/:id/events` calls return
`400`.

### Response `200`

```json
{ "archived": true }
```

---

## Send events

`POST /sessions/:id/events`

Accepts user events. `user.message` enqueues a run exactly like the beta
surface's `POST /run`; `user.interrupt` cancels queued work and returns the
session to `idle`; `user.tool_result` is accepted and recorded.

### Request body

```json
{
  "events": [
    { "type": "user.message", "content": "Keep going." },
    { "type": "user.interrupt" },
    { "type": "user.tool_result", "data": { "tool_call_id": "…", "output": "…" } }
  ]
}
```

### Response `200`

```json
{ "accepted": true }
```

---

## List events

`GET /sessions/:id/events`

Returns the session's full event history, oldest first, with Allternit type
names.

### Response `200`

```json
{
  "events": [
    {
      "id": "7b…",
      "sequence": 1,
      "type": "session.created",
      "session_id": "9f1c…",
      "created_at": "2026-09-10 12:00:00",
      "data": {}
    }
  ]
}
```

### Event types

**Lifecycle** — `session.created`, `session.running`, `session.idle`,
`session.waiting`, `session.failed`

**Computer** — `computer.pending`, `computer.ready`, `computer.failed`

**Turns** — `turn.started`, `turn.completed`, `turn.failed`

**Agent output** — `agent.message`, `agent.tool_use`, `agent.tool_result`

**User input** (send only) — `user.message`, `user.interrupt`,
`user.tool_result`

Each event is `{ "id", "type", "session_id", "created_at", "data" }` plus a
monotonic `sequence` for ordering.

---

## List turns

`GET /sessions/:id/turns`

Turns are derived from the public event stream. A `turn.started` event
opens a turn; `turn.completed` or `turn.failed` closes it. The turn `id`
is the `turn.started` event id. Oldest first. No pagination in this
release.

### Response `200`

```json
{
  "turns": [
    {
      "id": "7b…:turn.started",
      "status": "completed",
      "started_at": "2026-09-10 12:00:00",
      "completed_at": "2026-09-10 12:00:05"
    }
  ]
}
```

A turn still in flight has `status: "running"` and `completed_at: null`.
`user.interrupt` returns the session to `idle` but does not require a
`turn.failed` event; the open turn may still list as `running`.

---

## Stream events

`GET /sessions/:id/events/stream`

Server-sent events stream of the same public events. On connect, stored
history is replayed from the beginning (or from `?after=<sequence>`), then
live events follow. Each SSE frame's `data` is one event JSON and its
`event` field is the event type.

---

## Agents

`POST /agents/:id/archive` archives an agent (`status: "archived"`,
`archived_at` stamped). There is no unarchive. Agent JSON includes a
`version` integer (default `1`) that increments on every config-changing
update; pass `{ "id", "version" }` as the session's `agent` reference to
have mismatches rejected with `400`.

---

## Beta alias

`/api/v1/beta/sessions` (create/list/get/update/archive, `/run`, `/events`,
`/events/list`, `/events/ws`, `/interrupt`, resources, files, context)
continues to work unchanged on the same table. Beta responses keep the
stored event vocabulary (`session_created`, `run_requested`, …); the public
surface above is the one that translates to Allternit names.

## Status codes

| Code | When |
|------|------|
| `201` | Session created. |
| `200` | Retrieve, list, archive, send, list events. |
| `400` | Archived session, unknown event type, `computer.kind: "sandbox"` without entitlement, version mismatch. |
| `404` | Unknown session id. |
