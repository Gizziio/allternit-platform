# Kernel Brain Session Contract

**Version**: 1.1  
**Status**: Draft (Pending Implementation)  
**Scope**: API/ChatUI ↔ Kernel Service interface for brain session management  
**Freeze**: ChatUI/API changes frozen until kernel-side driver split is complete

---

## 1. Session Create Contract

### 1.1 Request Schema

```typescript
POST /v1/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  // REQUIRED: Brain profile identifier
  "brain_profile_id": string,
  
  // REQUIRED: Source context for session
  "source": "chat" | "terminal",
  
  // OPTIONAL: Workspace directory for the session
  "workspace_dir": string | null,
  
  // OPTIONAL: Specific plan ID if resuming/branching
  "plan_id": string | null,
  

  
  // OPTIONAL: Additional brain configuration overrides
  "config_overrides": {
    "env": Record<string, string>,
    "cwd": string,
    "args": string[]
  }
}
```

### 1.2 Source Semantics

| Source | Description | Allowed Brain Event Modes | Rendering Context |
|--------|-------------|---------------------------|-------------------|
| `chat` | API/ChatUI request | `acp`, `jsonl` | Message stream, tool panels |
| `terminal` | Interactive TUI/PTY | `acp`, `jsonl`, `terminal` | Terminal emulator with ANSI |

### 1.3 Kernel Enforcement Rules

**Rule 1**: `source="chat"` MUST reject any brain profile with `event_mode="terminal"`

**Rule 2**: `source="terminal"` MAY accept any brain profile (terminal or chat-capable)

**Rule 3**: Kernel MUST validate source/profile compatibility before session creation

### 1.4 Brain Profile Event Modes

```typescript
interface BrainProfile {
  id: string;
  name: string;
  // Event mode determines compatible sources
  event_mode: "acp" | "jsonl" | "terminal";
  
  // Driver type determines implementation
  driver: "headless_cli" | "terminal_app" | "acp" | "http_api";
  
  // Capabilities for feature detection
  capabilities: {
    streaming: boolean;
    tool_use: boolean;
    structured_output: boolean;
    persistent_session: boolean;
  };
}
```

**Clarification**:

`event_mode` defines the transport/protocol driver used by the kernel runtime:
- `"acp"` → ACP JSON-RPC over stdio (persistent, bidirectional)
- `"jsonl"` → Headless JSON-lines over stdio (one-shot or limited streaming)
- `"terminal"` → PTY interactive terminal session (human-facing only)

`source` defines the UI surface:
- `"chat"` → Semantic chat session
- `"terminal"` → Interactive TUI session

These two fields are orthogonal and must not share overlapping string values.

| Event Mode | Compatible Sources | Driver Type | Description |
|------------|-------------------|-------------|-------------|
| `acp` | `chat`, `terminal` | `acp` | ACP protocol (JSON-RPC over stdio) |
| `jsonl` | `chat`, `terminal` | `headless_cli` | NDJSON structured output |
| `terminal` | `terminal` only | `terminal_app` | PTY with ANSI escape codes |

### 1.5 Success Response (201 Created)

```json
{
  "id": "sess_01HQ1234567890ABCDEF",
  "brain_profile_id": "claude-code-headless",
  "source": "chat",
  "event_mode": "jsonl",
  "status": "active",
  "created_at": "2026-02-13T15:30:00Z",
  "pid": 12345,
  "capabilities": {
    "streaming": true,
    "tool_use": true,
    "structured_output": true,
    "persistent_session": false
  },
  "endpoints": {
    "events": "/v1/sessions/sess_01HQ1234567890ABCDEF/events",
    "input": "/v1/sessions/sess_01HQ1234567890ABCDEF/input"
  }
}
```

### 1.6 Error Response (409 Conflict - Mode Mismatch)

```json
{
  "error": {
    "code": "BRAIN_MODE_MISMATCH",
    "message": "Brain profile 'claude-code-tui' requires terminal source but request specified chat",
    "details": {
      "brain_profile_id": "claude-code-tui",
      "requested_source": "chat",
      "allowed_sources": ["terminal"],
      "event_mode": "terminal",
      "resolution": "Use brain profile 'claude-code-headless' for chat, or change source to 'terminal'"
    }
  }
}
```

**HTTP Status Codes**:
- `201 Created`: Session created successfully
- `400 Bad Request`: Invalid request schema
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Brain profile not found
- `409 Conflict`: Source/brain mode mismatch
- `422 Unprocessable Entity`: Brain requirements not met (missing binary, etc.)
- `503 Service Unavailable`: Brain runtime capacity exceeded

---

## 2. Event Contract

### 2.1 Event Stream Format

```
GET /v1/sessions/{session_id}/events
Accept: text/event-stream
Authorization: Bearer {token}

// Server-Sent Events (SSE) format
data: {"type": "chat.delta", "payload": {...}}

data: {"type": "chat.delta", "payload": {...}}

data: {"type": "chat.message.completed", "payload": {...}}
```

### 2.2 Kernel Event Guarantees (Non-Negotiable)

1. **If `source="chat"`**:
   - Kernel MUST NOT emit `terminal.delta`
   - Kernel MUST emit only:
     - `chat.delta`
     - `chat.message.completed`
     - `tool.call`
     - `tool.result`
     - `error`

2. **If `terminal.delta` appears in a `source="chat"` session**:
   - This is a contract violation.
   - API must:
     - Abort stream
     - Log protocol violation
     - Surface: "Kernel mode mismatch: terminal driver used for chat session"

**API must NOT attempt ANSI stripping or reinterpret terminal output as assistant chat.**

### 2.3 Chat-Source Event Types

**REQUIRED for chat source** (kernel MUST emit):

| Event Type | Payload Schema | Description |
|------------|----------------|-------------|
| `chat.delta` | `{ text: string, event_id?: string }` | Assistant text token/stream |
| `chat.message.completed` | `{ text: string, event_id?: string, stop_reason: string }` | Message generation complete |
| `tool.call` | `{ tool_id: string, call_id: string, args: object, event_id?: string }` | Tool invocation request |
| `tool.result` | `{ call_id: string, output: any, error?: string, event_id?: string }` | Tool execution result |
| `error` | `{ message: string, code: string, recoverable?: boolean }` | Runtime error |

**PROHIBITED for chat source** (kernel MUST NOT emit):

| Event Type | Rationale |
|------------|-----------|
| `terminal.delta` | Contains ANSI escape codes, terminal control sequences |
| `terminal.resize` | Terminal-specific, not applicable to chat |
| `pty.status` | PTY lifecycle events, chat uses headless processes |

### 2.4 Terminal-Source Event Types

**Additional events allowed for terminal source**:

| Event Type | Payload Schema | Description |
|------------|----------------|-------------|
| `terminal.delta` | `{ data: string, stream: "stdout" \| "stderr", event_id?: string }` | Raw terminal output with ANSI |
| `terminal.resize` | `{ cols: number, rows: number }` | Terminal dimension change |
| `pty.status` | `{ status: "connected" \| "disconnected", pid?: number }` | PTY lifecycle |

### 2.5 Event Examples

#### session.started (Always First)
```json
{
  "type": "session.started",
  "payload": {
    "session_id": "sess_01HQ1234567890ABCDEF",
    "brain_profile_id": "opencode-acp",
    "source": "chat",
    "event_mode": "acp",
    "capabilities": {
      "tools": true,
      "streaming": true
    },
    "pid": 42421
  },
  "timestamp": "2026-02-13T15:30:00.000Z"
}
```

**Required Behavior**:
- This event MUST be emitted before any `chat.delta`.
- API must assert: if `source="chat"` then `event_mode != "terminal"`, otherwise abort session immediately.

#### chat.delta (Text Stream)
```json
{
  "type": "chat.delta",
  "payload": {
    "text": "I'll help you refactor this function.",
    "event_id": "evt_01HQ1234567890ABC"
  },
  "timestamp": "2026-02-13T15:30:01.234Z",
  "session_id": "sess_01HQ1234567890ABCDEF"
}
```

#### chat.message.completed
```json
{
  "type": "chat.message.completed",
  "payload": {
    "text": "I'll help you refactor this function. Let me start by reading the current implementation...",
    "stop_reason": "end_turn",
    "event_id": "evt_01HQ1234567890ABC",
    "usage": {
      "prompt_tokens": 150,
      "completion_tokens": 45
    }
  },
  "timestamp": "2026-02-13T15:30:05.678Z",
  "session_id": "sess_01HQ1234567890ABCDEF"
}
```

#### tool.call (Tool Invocation)
```json
{
  "type": "tool.call",
  "payload": {
    "tool_id": "Read",
    "call_id": "call_01HQ1234567890XYZ",
    "args": {
      "file_path": "src/main.rs"
    },
    "event_id": "evt_01HQ1234567890DEF"
  },
  "timestamp": "2026-02-13T15:30:02.456Z",
  "session_id": "sess_01HQ1234567890ABCDEF"
}
```

#### tool.result (Tool Completion)
```json
{
  "type": "tool.result",
  "payload": {
    "call_id": "call_01HQ1234567890XYZ",
    "output": "fn main() { println!(\"Hello\"); }",
    "event_id": "evt_01HQ1234567890GHI"
  },
  "timestamp": "2026-02-13T15:30:03.789Z",
  "session_id": "sess_01HQ1234567890ABCDEF"
}
```

#### terminal.delta (Terminal-Only - NEVER in chat sessions)
```json
{
  "type": "terminal.delta",
  "payload": {
    "data": "\u001b[?25l\u001b[1;32m>\u001b[0m explain this\n\u001b[?25h",
    "stream": "stdout",
    "event_id": "evt_01HQ1234567890JKL"
  },
  "timestamp": "2026-02-13T15:30:00.123Z",
  "session_id": "sess_01HQ1234567890TERMINAL"
}
```

**CRITICAL**: `terminal.delta` is PROHIBITED in `source="chat"` sessions. This is a kernel contract violation, not a filtering concern.

#### error
```json
{
  "type": "error",
  "payload": {
    "message": "Brain process terminated unexpectedly",
    "code": "BRAIN_RUNTIME_ERROR",
    "recoverable": false
  },
  "timestamp": "2026-02-13T15:30:10.000Z",
  "session_id": "sess_01HQ1234567890ABCDEF"
}
```

---

## 3. Input Contract

### 3.1 Sending Input

```
POST /v1/sessions/{session_id}/input
Content-Type: application/json

{
  "text": "Continue with the refactoring"
}
```

**Response**: `200 OK` (accepted) or `409 Conflict` (session not accepting input)

### 3.2 One-Shot Endpoint (Optional, Separate From Sessions)

If one-shot headless execution is required, define:

```
POST /v1/oneshot
```

This must NOT create a persistent session.

Session-based endpoints must remain:
- `POST /v1/sessions`
- `POST /v1/sessions/{id}/input`
- `GET  /v1/sessions/{id}/events`

No hybrid invocation inside session create.

---

## 4. Acceptance Criteria

### 4.1 Chat Session with ACP/JSONL Brain

**Given**: Chat UI creates session with:
```json
{
  "brain_profile_id": "opencode-acp",
  "source": "chat"
}
```

**When**: User sends message and streams events

**Then**:
- [ ] First event is `session.started` with `event_mode: "acp"`
- [ ] Kernel creates `AcpProtocolDriver` (not PTY-based)
- [ ] Event stream contains ONLY: `chat.delta`, `chat.message.completed`, `tool.call`, `tool.result`, `error`
- [ ] ZERO `terminal.delta` events
- [ ] Text content is clean assistant message stream
- [ ] Tool negotiation works via kernel (ACP mode)

### 4.2 Chat Session Selecting Terminal Brain (Rejection)

**Given**: Chat UI creates session with:
```json
{
  "brain_profile_id": "claude-code-tui",
  "source": "chat"
}
```

**Where**: `claude-code-tui` profile has `event_mode: "terminal"`

**Then**:
- [ ] Kernel returns `409 Conflict`
- [ ] Error code: `BRAIN_MODE_MISMATCH`
- [ ] Error message includes actionable resolution:
  ```
  "Brain profile 'claude-code-tui' requires terminal source but request specified chat. 
   Use brain profile 'claude-code-headless' for chat, or change source to 'terminal'."
  ```
- [ ] No session is created
- [ ] No brain process is spawned

### 4.3 Terminal Session with PTY Brain

**Given**: Terminal UI creates session with:
```json
{
  "brain_profile_id": "claude-code-tui",
  "source": "terminal"
}
```

**When**: User interacts via PTY

**Then**:
- [ ] First event is `session.started` with `event_mode: "terminal"`
- [ ] Kernel creates `TerminalAppDriver` with PTY
- [ ] Event stream contains `terminal.delta` with ANSI codes
- [ ] Chat UI does not render `terminal.delta` as assistant text

### 4.4 Driver Selection Matrix

| Source | Brain Event Mode | Selected Driver | PTY? |
|--------|-----------------|-----------------|------|
| `chat` | `acp` | `AcpProtocolDriver` | No |
| `chat` | `jsonl` | `HeadlessCliDriver` | No |
| `chat` | `terminal` | **REJECTED (409)** | N/A |
| `terminal` | `terminal` | `TerminalAppDriver` | Yes |
| `terminal` | `acp` | `AcpProtocolDriver` | No |
| `terminal` | `jsonl` | `HeadlessCliDriver` | No |

---

## 5. Error Codes Reference

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `BRAIN_MODE_MISMATCH` | 409 | Source/chat vs terminal mismatch | Use compatible brain profile or change source |
| `BRAIN_PROFILE_NOT_FOUND` | 404 | brain_profile_id doesn't exist | Check available profiles |
| `BRAIN_REQUIREMENTS_NOT_MET` | 422 | Missing binary, API key, etc. | Install requirements |
| `BRAIN_RUNTIME_ERROR` | 500 | Brain process crashed | Retry or select different brain |
| `BRAIN_CAPACITY_EXCEEDED` | 503 | Too many concurrent sessions | Wait and retry |
| `SESSION_NOT_FOUND` | 404 | Session ID doesn't exist | Create new session |
| `SESSION_NOT_ACCEPTING_INPUT` | 409 | Session is processing or closed | Wait for completion |

---

## 6. Migration Path

### Phase 1: ACP Protocol Driver (Primary)
1. Implement `AcpProtocolDriver`
2. Reference implementation: `opencode acp`
3. Must support:
   - `initialize`
   - Session management
   - Streaming message chunks
   - Tool request / tool response

ACP is the canonical CLI brain protocol.

### Phase 2: JSONL Headless Driver (Compatibility)
1. For CLIs lacking ACP support
2. Pipes only (no PTY)
3. Must emit semantic `chat.delta` events
4. No bidirectional tool negotiation

### Phase 3: TerminalAppDriver (Human-Only)
1. PTY-based
2. Emits only `terminal.delta`
3. Never valid for `source="chat"`

### Phase 4: API Update
1. API adds `source: "chat"` to all chat requests
2. API aborts on `terminal.delta` in chat streams (contract violation)
3. API surfaces `BRAIN_MODE_MISMATCH` errors to users

### Phase 5: Profile Migration
1. Mark terminal-only profiles with `event_mode: "terminal"`
2. Create ACP equivalents: `claude-code` → `opencode-acp` or `claude-code-acp`
3. Update ChatUI model picker to exclude terminal-only brains

---

## 7. Session Mode Immutability

- `source` is immutable after session creation.
- `event_mode` is immutable after driver selection.
- Switching from chat to terminal requires a new session.
- Attaching a terminal view does not change `event_mode`.

## 8. Tool Execution Model (ACP Mode)

In ACP sessions:
- `tool.call` represents a request from the brain runtime to the kernel.
- Kernel is responsible for:
  - Executing registered tools
  - Emitting `tool.result`
  - Sending result back to ACP runtime

Brains must not execute tools internally when in ACP mode.

This ensures platform-owned orchestration (OpenClaw-style model).

## 9. Open Questions

1. **Hybrid Brains**: Should some brains support both modes (auto-detect or explicit flag)?
2. **Tool Rendering**: Should `tool.call`/`tool.result` be rendered inline or in separate panel?
3. **Error Recovery**: For `recoverable: true` errors, should API automatically retry or surface to user?

---

**Document Owner**: Kernel Team  
**Reviewers**: API Team, ChatUI Team  
**Target Implementation**: Kernel Sprint 1, API Sprint 2