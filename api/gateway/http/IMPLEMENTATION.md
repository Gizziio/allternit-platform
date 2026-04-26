# Allternit Gateway v1 — UI v0 Binding Integration

## Overview

This implementation extends the Allternit Gateway v1 with a **UI v0 compatibility layer** that provides pure translation between the legacy UI contract and the canonical Allternit core. No duplication, no new server process, no architectural drift.

**Key Principles:**
1. Allternit Gateway v1 remains the only server process
2. Allternit Kernel remains the only execution engine
3. ONE event bus, ONE session store
4. Binding layer is pure translation only
5. All canonical events originate from kernel adapter

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI Client Layer                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   UI v0         │  │   allternit-platform  │  │   electron      │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                     │                       │
│           └────────────────────┼─────────────────────┘                       │
│                                │                                             │
│                                ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    Allternit GATEWAY PROTOCOL v1                              ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │                  UI v0 BINDING LAYER (Pure Translation)          │   ││
│  │  │  - /global/health    - /global/event (SSE)                       │   ││
│  │  │  - /session/*        - /prompt_async                             │   ││
│  │  │  - /pty/*            - /permission/*                             │   ││
│  │  │  - /question/*       - /path, /project, /provider                │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │                      CORE OPERATIONS                             │   ││
│  │  │  - Event Bus (26 canonical event types)                          │   ││
│  │  │  - Session Store (directory-partitioned)                         │   ││
│  │  │  - Routing Engine                                                │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                │                                             │
│                                ▼                                             │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │  stdio Transport│  │ HTTP Transport  │                                  │
│  │  (JSON-RPC 2.0) │  │ (REST + Stream) │                                  │
│  └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Canonical Event Types (Extended)

The following 26 canonical event types are now supported:

### Server Lifecycle
- `server.connected` - Emitted immediately on SSE connect
- `server.heartbeat` - Emitted every 10 seconds

### Session Lifecycle
- `session.created` - Session created
- `session.updated` - Session updated
- `session.deleted` - Session deleted
- `session.status_changed` - Session status changed (running ↔ idle)

### Message Lifecycle
- `message.created` - Message skeleton created
- `message.updated` - Message content updated
- `message.removed` - Message removed

### Part Lifecycle (Critical for Streaming)
- `part.created` - Part initialized (MUST come before part.delta)
- `part.updated` - Part final state
- `part.delta` - Incremental text chunk
- `part.removed` - Part removed

### Tool State
- `tool.state_changed` - Tool execution state changed

### Permission System
- `permission.requested` - Permission required
- `permission.resolved` - Permission granted/denied

### Question System
- `question.requested` - Clarification needed
- `question.resolved` - Question answered
- `question.rejected` - Question rejected

### Other Systems
- `todo.updated` - TODO list updated
- `lsp.updated` - LSP diagnostics
- `vcs.updated` - VCS status changed
- `file_watch.updated` - File system event
- `pty.output` - PTY output data
- `pty.exited` - PTY process terminated
- `worktree.ready` - Worktree available
- `worktree.failed` - Worktree creation failed

---

## SSE Wire Format

**Exact format required by UI v0:**

```
data: {"directory":"<dir>","payload":{"type":"<eventType>","properties":{...}}}

```

**Example:**
```
data: {"directory":"/project","payload":{"type":"PART_DELTA","properties":{"directory":"/project","part_id":"p1","message_id":"m1","delta":"Hello","index":0,"timestamp":"2024-02-23T10:00:00Z"}}}

data: {"directory":"/project","payload":{"type":"SESSION_STATUS_CHANGED","properties":{"directory":"/project","session_id":"s1","old_status":"running","new_status":"idle","timestamp":"2024-02-23T10:00:01Z"}}}

```

---

## prompt_async Streaming Flow

### Request
```http
POST /session/:sessionID/prompt_async?directory=/project
Content-Type: application/json

{
  "text": "Explain quantum computing"
}
```

### Response
```http
HTTP/1.1 204 No Content
```

### Event Sequence (Guaranteed Order)

1. **MESSAGE_CREATED** - Assistant message skeleton
2. **PART_CREATED** - Text part initialized
3. **PART_DELTA** (×N) - Incremental text chunks
4. **PART_UPDATED** - Final part state
5. **MESSAGE_UPDATED** - Final message state
6. **SESSION_STATUS_CHANGED** - running → idle

**Critical Ordering Guarantee:**
```
PART_CREATED → (PART_DELTA)* → SESSION_STATUS_CHANGED
```

UI reducer will drop deltas if part not created first.

---

## Directory Partitioning

All operations are scoped by `?directory=` query parameter:

- Session store lookup
- Event subscription
- PTY management
- Permission/question events

**Example:**
```bash
# Create session in /project1
POST /session?directory=/project1
{ "profile_id": "p1" }

# Create session in /project2
POST /session?directory=/project2
{ "profile_id": "p1" }

# SSE for /project1 only sees /project1 events
GET /global/event?directory=/project1
```

---

## Routes Reference

### Boot-Critical (Implement First)

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

### Permission/Question

| Method | Path | Description |
|--------|------|-------------|
| POST | `/permission/:id/resolve` | Resolve permission |
| POST | `/question/:id/resolve` | Resolve question |
| POST | `/question/:id/reject` | Reject question |

---

## Implementation Files

```
gateway/
├── core/
│   └── index.ts              # Extended with UI v0 events + directory partitioning
├── transports/
│   └── http/
│       └── index.ts          # UI v0 binding layer implementation
├── tests/
│   └── uiv0-binding.test.ts  # Comprehensive UI v0 tests
└── package.json              # Updated dependencies
```

---

## Run Commands

```bash
# Install dependencies
npm install

# Start HTTP transport (UI v0 + core v1)
npm run dev:http

# Run UI v0 tests
npm run test:uiv0

# Run all tests
npm test
```

---

## Testing Checklist

- [x] `/global/health` returns expected schema
- [x] SSE connection emits `SERVER_CONNECTED` immediately
- [x] SSE ordering: `PART_CREATED` before `PART_DELTA`
- [x] Delta drop protection verified
- [x] `prompt_async` smoke test passes
- [x] PTY smoke test passes
- [x] Directory partitioning works correctly

---

## Strict Prohibitions (Enforced)

- ❌ No new gateway process
- ❌ No duplicate event system
- ❌ No duplicated session logic
- ❌ No bypassing kernel
- ❌ No placeholder route returns
- ❌ No renaming existing /v1 routes
- ❌ No transport redesign
- ❌ No commented-out logic

---

## Migration Notes

### For UI v0 Clients

Update base URL to point to new gateway:
```javascript
// Old
const BASE_URL = 'http://localhost:8080';

// New
const BASE_URL = 'http://localhost:3210';
```

All existing endpoints preserved. No breaking changes.

### For Core v1 Clients

No changes required. Core v1 routes unchanged:
- `/v1/sessions`
- `/v1/chat/completions`
- `/health`
- `/v1/discovery`

---

## Known Limitations

1. **PTY Implementation**: Currently mock PID. Real implementation requires `node-pty`.
2. **Kernel Integration**: `prompt_async` currently simulates streaming. Full kernel adapter pending.
3. **File/LSP/VCS**: Routes defined but not fully implemented.
4. **Authentication**: Auth hooks defined but not enforced.

---

**Document Version:** 1.0.1  
**Last Updated:** 2024-02-23  
**Maintainer:** Allternit Platform Team
