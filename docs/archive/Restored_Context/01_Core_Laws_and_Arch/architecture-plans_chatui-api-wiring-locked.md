# 🔒 ChatUI/API Wiring – Final Locked Instructions

**This work depends on ACP kernel being protocol-correct.**

You are wiring to the kernel contract.  
You are not implementing routing logic.

**Kernel owns:**
- Driver selection
- EventMode enforcement
- Tool execution
- ACP handshake
- Protocol semantics

**API + ChatUI only:**
- Proxy session creation
- Stream kernel events
- Enforce mode invariants
- Render semantic events

---

## 1️⃣ Session Creation (Non-Negotiable)

When calling:

```
POST /v1/sessions
```

Payload must include:

```json
{
  "brain_profile_id": "...",
  "source": "chat"
}
```

- Never omit `source`
- Never set `event_mode` unless explicitly user-overridden

**API does not decide drivers.**  
**API does not decide protocols.**

---

## 2️⃣ SSE Stream – Hard Gate on First Event

When streaming:

```
GET /v1/sessions/{id}/events
```

Implementation must:
1. **Buffer until first event arrives**
2. **Assert first event is `session.started`**
3. **Extract `event_mode`**

**If:**

```
event_mode == "terminal"
```

**Then:**
- Abort immediately
- Return frontend error:
  > "Selected brain is terminal-only. Open Terminal view or choose an ACP/JSONL brain."
- Log structured error including:
  - `session_id`
  - `brain_profile_id`
  - `event_mode`

**No partial assistant rendering allowed.**

---

## 3️⃣ Strict Event Mapping (No ANSI, No Heuristics)

### Allowed → Render

| Kernel Event | Frontend Action |
|--------------|-----------------|
| `chat.delta` | Append text delta |
| `chat.message.completed` | Finalize message |
| `tool.call` | Show tool running |
| `tool.result` | Resolve tool |
| `error` | Finish with error |

### Forbidden → Abort

| Kernel Event |
|--------------|
| `terminal.delta` |

**If `terminal.delta` appears in chat stream:**
- Abort
- Log contract violation
- Show clear error

**Do not strip ANSI.**  
**Do not try to reinterpret terminal output.**  
**Do not convert it to chat text.**

---

## 4️⃣ Model Picker Guard

UI must:
- Clearly label terminal-only profiles
- Block chat submission if terminal-only selected
- Offer "Open Terminal View" option

**No silent fallback.**

---

## 5️⃣ Tool Rendering

UI must:
- Show `tool.call` immediately
- Replace with `tool.result` when it arrives
- Allow assistant to continue streaming after tool resolution

**API does not execute tools.**  
**Kernel does.**

---

## 6️⃣ Logging (Mandatory)

Add structured logs for:
- `session.started`
- Mode mismatch aborts
- Kernel error events
- Stream termination reason

**This is critical for diagnosing protocol violations.**

---

## 7️⃣ Acceptance Tests (Must Demonstrate)

### Test A – ACP profile
- First event = `session.started`
- `event_mode` = `acp`
- Only `chat.delta`/`chat.message.completed` thereafter
- No `terminal.delta` ever

### Test B – Terminal profile selected in chat
- First event = `session.started`
- `event_mode` = `terminal`
- API aborts immediately
- No assistant text rendered

### Test C – Tool loop
- `tool.call` visible
- `tool.result` visible
- Assistant continues

---

## 8️⃣ Absolute DO NOT List

**Do NOT:**
- Strip ANSI
- Parse terminal output
- Add provider routing logic
- Assume ACP handshake success
- Modify kernel driver behavior
- Render any event before `session.started`

---

## Why This Is Correct

This keeps:
- Kernel as authority
- API as thin transport
- UI as semantic renderer
- No driver leakage
- No protocol drift
- No TUI contamination

**This wiring is compatible with:**
- ACP
- JSONL fallback
- Future protocols

---

**Deliverables:**
1. PR with API + UI changes above
2. Test notes/logs showing the three acceptance tests

**Blocked on:** Kernel ACP Phase 1 completion