# UI Contract Legacy Specification

**Contract ID:** `ui-contract-legacy@2026-02`  
**Status:** Frozen  
**Effective:** 2026-02-23  
**Gateway Version:** 1.0.1+

---

## Overview

This document specifies the legacy UI contract for the A2R Gateway. This contract is **frozen** — no breaking changes allowed. New contracts should use a new contract ID.

**Implementation:** `4-services/a2r-gateway/bindings/ui_contract_legacy/`

---

## Wire Format

All SSE events use this envelope structure:

```json
{
  "directory": "<string>",
  "payload": {
    "type": "<UI_EVENT_TYPE>",
    "properties": { ... }
  }
}
```

**Example:**
```json
{
  "directory": "/project",
  "payload": {
    "type": "PART_DELTA",
    "properties": {
      "directory": "/project",
      "part_id": "p1",
      "message_id": "m1",
      "delta": "Hello",
      "index": 0,
      "timestamp": "2026-02-23T10:00:00Z"
    }
  }
}
```

---

## Event Types

### Server Lifecycle

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `server.connected` | `SERVER_CONNECTED` | Emitted immediately on SSE connect |
| `server.heartbeat` | `SERVER_HEARTBEAT` | Emitted every 10 seconds |

**SERVER_CONNECTED Properties:**
```json
{
  "directory": "/project",
  "timestamp": "2026-02-23T10:00:00Z"
}
```

**SERVER_HEARTBEAT Properties:**
```json
{
  "directory": "/project",
  "timestamp": "2026-02-23T10:00:10Z"
}
```

---

### Session Lifecycle

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `session.created` | `SESSION_CREATED` | Session created |
| `session.updated` | `SESSION_UPDATED` | Session updated |
| `session.deleted` | `SESSION_DELETED` | Session deleted |
| `session.status_changed` | `SESSION_STATUS_CHANGED` | Status changed |

**SESSION_STATUS_CHANGED Properties:**
```json
{
  "directory": "/project",
  "session_id": "s1",
  "old_status": "running",
  "new_status": "idle",
  "timestamp": "2026-02-23T10:00:05Z"
}
```

---

### Message Lifecycle

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `message.created` | `MESSAGE_CREATED` | Message skeleton created |
| `message.updated` | `MESSAGE_UPDATED` | Message content updated |
| `message.removed` | `MESSAGE_REMOVED` | Message removed |

---

### Part Lifecycle (Streaming)

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `part.created` | `PART_CREATED` | Part initialized |
| `part.updated` | `PART_UPDATED` | Part final state |
| `part.delta` | `PART_DELTA` | Incremental text chunk |
| `part.removed` | `PART_REMOVED` | Part removed |

**CRITICAL ORDERING GUARANTEE:**

```
PART_CREATED → (PART_DELTA)* → PART_UPDATED
```

UI reducer will drop `PART_DELTA` events if `PART_CREATED` has not been received first.

**PART_CREATED Properties:**
```json
{
  "directory": "/project",
  "part_id": "p1",
  "message_id": "m1",
  "type": "text",
  "content": "",
  "created_at": "2026-02-23T10:00:01Z"
}
```

**PART_DELTA Properties:**
```json
{
  "directory": "/project",
  "part_id": "p1",
  "message_id": "m1",
  "delta": "Hello",
  "index": 0,
  "timestamp": "2026-02-23T10:00:02Z"
}
```

---

### Tool State

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `tool.state_changed` | `TOOL_STATE_CHANGED` | Tool execution state |

---

### Permission System

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `permission.requested` | `PERMISSION_REQUESTED` | Permission required |
| `permission.resolved` | `PERMISSION_RESOLVED` | Permission granted/denied |

---

### Question System

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `question.requested` | `QUESTION_REQUESTED` | Clarification needed |
| `question.resolved` | `QUESTION_RESOLVED` | Question answered |
| `question.rejected` | `QUESTION_REJECTED` | Question rejected |

---

### Other Systems

| Canonical Event | UI Type | Description |
|-----------------|---------|-------------|
| `todo.updated` | `TODO_UPDATED` | TODO list updated |
| `lsp.updated` | `LSP_UPDATED` | LSP diagnostics |
| `vcs.updated` | `VCS_UPDATED` | VCS status |
| `file_watch.updated` | `FILE_WATCH_UPDATED` | File system event |
| `pty.output` | `PTY_OUTPUT` | PTY output data |
| `pty.exited` | `PTY_EXITED` | PTY process terminated |
| `worktree.ready` | `WORKTREE_READY` | Worktree available |
| `worktree.failed` | `WORKTREE_FAILED` | Worktree creation failed |

---

## REST Endpoints

### Boot-Critical

| Method | Path | Description |
|--------|------|-------------|
| GET | `/global/health` | Health check |
| GET | `/global/event` | SSE event stream |
| GET | `/path` | Project path info |
| GET | `/project` | Project metadata |
| GET | `/provider` | Provider configuration |
| GET | `/permission` | List permissions |
| GET | `/question` | List questions |
| GET | `/session/status` | Session status |

### Chat-Critical

| Method | Path | Description |
|--------|------|-------------|
| POST | `/session` | Create session |
| GET | `/session/:id` | Get session |
| GET | `/session/:id/message` | Get messages |
| POST | `/session/:id/prompt_async` | Async prompt (streaming) |
| POST | `/session/:id/abort` | Abort execution |

### PTY

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pty` | Create PTY |
| PUT | `/pty/:id` | Send input |
| DELETE | `/pty/:id` | Kill PTY |
| GET | `/pty/:id/connect` | WebSocket connection |

---

## Directory Partitioning

All operations support `?directory=` query parameter:

```
GET /global/event?directory=/project1
POST /session?directory=/project1
```

Events are scoped to directory. Cross-directory leakage is prohibited.

---

## Contract ID Reference

```typescript
// bindings/ui_contract_legacy/contracts.ts
export const UI_CONTRACT_ID = 'ui-contract-legacy@2026-02';
```

---

## Change Policy

**This contract is FROZEN.**

- No breaking changes allowed
- New features require new contract ID
- Deprecation requires 6-month notice

---

## Related Documents

- `/spec/Networking.md` - Protocol v1 specification
- `/spec/ProtocolMap.md` - Contract mapping reference
- `4-services/a2r-gateway/REPO_LAW.md` - Version naming and event boundaries

---

**Maintainer:** A2R Platform Team  
**Last Updated:** 2026-02-23
