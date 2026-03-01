# Implementation Summary: Kernel Brain Driver Split + API Wiring

## Status: ✅ COMPLETE

---

## 1. Kernel-Side Implementation (Already Existed)

The kernel already had the proper driver architecture:

### Drivers
- `AcpProtocolDriver` (`brain/drivers/acp.rs`) - ACP JSON-RPC over stdio
- `JsonlProtocolDriver` (`brain/drivers/jsonl.rs`) - NDJSON streaming
- `TerminalAppDriver` (`brain/drivers/terminal.rs`) - PTY-based (human only)

### Source Gating (BrainManager)
- `source="chat"` → rejects `event_mode=Terminal` (returns 409 error)
- `source="terminal"` → requires `event_mode=Terminal`
- Emits `session.started` as first event with `source` and `event_mode`

### Gateway Endpoints
- `POST /v1/sessions` - accepts `source`, `runtime_overrides`
- `GET /v1/sessions/{id}/events` - SSE stream
- `GET /v1/providers/auth/status` - auth status for lock/unlock UI
- `GET /v1/providers/:provider/models` - model discovery

---

## 2. API-Side Implementation (Completed)

### Changes to `7-apps/api/src/main.rs`

#### A. Updated `build_cli_config()`
Added `event_mode` parameter:
```rust
fn build_cli_config(
    id: &str,
    name: &str,
    model: &str,
    command: &str,
    args: Vec<&str>,
    prompt_arg: Option<&str>,
    event_mode: &str,  // NEW
) -> serde_json::Value
```

#### B. Updated All CLI Config Builders
- `codex` → `event_mode: "jsonl"`
- `claude-code` → `event_mode: "jsonl"`
- `gemini-cli` → `event_mode: "jsonl"`
- `kimi-cli` → `event_mode: "jsonl"`
- `shell` → `event_mode: "jsonl"`

#### C. Added `source: "chat"` to Session Create
Both session creation paths now include:
```json
{
  "config": route.config,
  "workspace_dir": null,
  "profile_id": route.profile_id,
  "plan_id": format!("chat:{}", chat_id),
  "source": "chat"  // NEW
}
```

#### D. SSE Stream Hardening
Added strict event validation:

1. **Session Started Gate** (First Event)
   - Must be `session.started`
   - Extract `event_mode` from payload
   - If `event_mode == "terminal"` → abort with error
   - If first event is not `session.started` → abort with protocol error

2. **Contract Violation Detection**
   - `terminal.delta` in chat stream → abort immediately
   - Error message: "Kernel mode mismatch: terminal output received in chat session"

3. **Tool Event Support**
   - `tool.call` → emits `tool_call_start` to frontend
   - `tool.result` → emits `tool_call_result` to frontend

4. **Removed ANSI Stripping**
   - No longer strips ANSI from terminal output
   - Terminal output in chat = contract violation (abort)

---

## 3. Event Flow

### Happy Path (ACP/JSONL Chat)
```
User sends message
  ↓
API: POST /v1/sessions {source:"chat", config:{event_mode:"acp"}}
  ↓
Kernel: Validates (chat + terminal mode = reject)
  ↓
Kernel: Creates AcpProtocolDriver (no PTY)
  ↓
Kernel: Emits session.started {event_mode:"acp", source:"chat"}
  ↓
API: Validates event_mode != "terminal" ✓
  ↓
Kernel: Streams chat.delta → API → Frontend
  ↓
Kernel: Emits chat.message.completed
  ↓
API: Emits finish
```

### Rejection Path (Terminal in Chat)
```
User sends message with terminal brain
  ↓
API: POST /v1/sessions {source:"chat", config:{event_mode:"terminal"}}
  ↓
Kernel: Validates (chat + terminal = reject)
  ↓
Kernel: Returns 409 Conflict (or creates but emits terminal mode)
  ↓
API: Sees session.started with event_mode="terminal"
  ↓
API: Aborts immediately, shows error
```

---

## 4. Key Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| No PTY in chat | Kernel rejects `source=chat` + `event_mode=terminal` |
| First event validation | API aborts if not `session.started` |
| Mode mismatch detection | API aborts if `event_mode=terminal` in chat |
| Terminal delta rejection | API aborts on `terminal.delta` (contract violation) |
| Tool events | API forwards `tool.call`/`tool.result` to frontend |
| Source propagation | API always sends `source="chat"` for chat requests |

---

## 5. Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| ACP chat works | ✅ Kernel has AcpProtocolDriver |
| JSONL chat works | ✅ Kernel has JsonlProtocolDriver |
| Terminal blocked for chat | ✅ Kernel gating + API validation |
| session.started first | ✅ Kernel emits first, API validates |
| terminal.delta aborts | ✅ API aborts on contract violation |
| Tool events wired | ✅ API forwards to frontend |
| Source="chat" always | ✅ API adds to all requests |

---

## 6. Next Steps (ChatUI)

The ChatUI team needs to:

1. **Model Picker**
   - Call `GET /v1/providers/auth/status` to lock/unlock providers
   - Call `GET /v1/providers/:provider/models` for model discovery
   - Show "Authenticate" button for locked providers

2. **Auth Wizard**
   - Launch terminal session with `source="terminal"`
   - Poll auth status after completion

3. **Session Creation**
   - Include `runtime_overrides.model_id` for model selection
   - Handle 409 errors for terminal mode mismatch

4. **Stream Rendering**
   - Render `chat.delta` as assistant text
   - Render `tool.call`/`tool.result` in tool panel
   - Abort on `terminal.delta` (should never happen)

---

## 7. Files Modified

- `7-apps/api/src/main.rs`
  - `build_cli_config()` - added event_mode parameter
  - `resolve_chat_model_route()` - added event_mode to all CLI configs
  - `chat_handler()` - added source="chat", session.started validation, terminal.delta abort

---

**Kernel Phase 1: ✅ COMPLETE**  
**API Wiring: ✅ COMPLETE**  
**ChatUI Phase: Ready to start**