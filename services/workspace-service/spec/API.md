# allternit-workspace-service API Spec

## Overview

The workspace service exposes a small HTTP API for managing terminal sessions
and a per-workspace skills registry. It is designed to be consumed by the Rails
workspace client and by agent runtimes that need to spawn or interact with
terminal sessions without depending on a full tmux/pty stack.

## Transport

- HTTP/1.1
- JSON request/response bodies
- CORS enabled for browser/Electron consumers
- Default bind address: `127.0.0.1:3021`

## Resources

### Session

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUIDv4 session identifier |
| `name` | string | Human-readable name |
| `status` | string | `active`, `idle`, or `stopped` |
| `panes` | integer | Number of panes in the session |
| `workspace_id` | string? | Optional team workspace id |
| `created_at` | ISO8601 | Creation timestamp |

### Pane

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUIDv4 pane identifier |
| `session_id` | string | Parent session id |
| `title` | string | Display title |

### Skill

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUIDv4 skill identifier |
| `workspace_id` | string | Workspace the skill belongs to |
| `name` | string | Skill name |
| `description` | string? | Human-readable description |
| `manifest` | string? | JSON-encoded manifest (prompt/tools) |
| `source_repo` | string? | Source repository url |
| `version` | string | Semantic version |
| `installed_by` | string | Actor that registered the skill |
| `installed_at` | ISO8601 | Registration timestamp |

## Endpoints

### `GET /health`

Liveness check. Returns counts of active resources.

**Response 200:**

```json
{
  "status": "ok",
  "sessions": 0,
  "panes": 0,
  "skills": 0
}
```

### `POST /sessions`

Create a new session.

**Request body:**

```json
{
  "name": "string",
  "working_dir": "string?",
  "env": { "string": "string" },
  "metadata": { "owner": "string?", "labels": ["string"] },
  "workspace_id": "string?"
}
```

**Response 201:**

```json
{ "session": { /* Session */ } }
```

### `GET /sessions/:id`

Fetch a session by id or name.

**Response 200:** `{ "session": { /* Session */ } }`
**Response 404:** `{ "error": "Session not found" }`

### `DELETE /sessions/:id`

Delete a session and all of its panes.

**Response 204:** No content
**Response 404:** Not found

### `POST /sessions/:id/panes`

Create a pane inside a session.

**Request body:**

```json
{
  "name": "string",
  "command": "string?",
  "metadata": { "agent_id": "string?", "pane_type": "string?" }
}
```

**Response 201:** `{ "id": "string", "session_id": "string", "title": "string" }`
**Response 404:** `{ "error": "Session not found" }`

### `DELETE /panes/:id`

Delete a pane.

**Response 204:** No content
**Response 404:** Not found

### `GET /panes/:id/capture`

Return the current output buffer of a pane.

**Response 200:** `{ "output": "string" }`
**Response 404:** `{ "error": "Pane not found" }`

### `POST /panes/:id/send`

Append simulated input to a pane's output buffer.

**Request body:** `{ "keys": "string" }`

**Response 200:** `{ "ok": true }`

### `GET /panes/:id/logs`

Alias for `GET /panes/:id/capture`.

**Response 200:** `{ "logs": "string" }`
**Response 404:** `{ "error": "Pane not found" }`

### `GET /skills`

List skills for a workspace.

**Query params:** `workspace_id` (defaults to `""`).

**Response 200:** `{ "skills": [ /* Skill */ ] }`

### `POST /skills`

Register a new skill.

**Request body:**

```json
{
  "workspace_id": "string",
  "name": "string",
  "description": "string?",
  "manifest": "string?",
  "source_repo": "string?",
  "version": "string?",
  "installed_by": "string"
}
```

**Response 201:** `{ "skill": { /* Skill */ } }`

### `GET /skills/:id`

Fetch a skill by id.

**Response 200:** `{ "skill": { /* Skill */ } }`
**Response 404:** `{ "error": "Skill not found" }`

### `DELETE /skills/:id`

Delete a skill.

**Response 204:** No content
**Response 404:** Not found

## Error Handling

All error responses use JSON bodies with an `error` field. HTTP status codes
follow standard semantics: `201` for creation, `204` for deletion, `404` for
missing resources.
