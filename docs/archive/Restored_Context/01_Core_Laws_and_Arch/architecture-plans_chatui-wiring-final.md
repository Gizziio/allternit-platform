# ChatUI/API Wiring – Execute Now (UI + API only, no kernel changes)

**Scope:** Implement UI behavior and API proxy logic. Kernel ACP contract is assumed stable.

---

## 1. Provider Auth Status Check

**New API endpoint to call on model picker load:**

```
GET /v1/providers/auth/status
```

**Response:**
```json
{
  "providers": [
    {
      "provider_id": "openai",
      "status": "ok" | "missing" | "expired",
      "auth_required": true | false,
      "auth_profile_id": "openai-auth"
    }
  ]
}
```

---

## 2. Lock Models When Auth Missing

**In model picker UI:**

| Status | Behavior |
|--------|----------|
| `ok` or `auth_required: false` | Model selectable |
| `missing` or `expired` | Model locked, show "Authenticate" button |

**Authenticate button action:**
- Launch terminal session with `auth_profile_id`
- User completes auth flow in terminal
- Poll auth status again
- Unlock model on `status: "ok"`

---

## 3. Session Create (Strict)

**When user sends chat message:**

```
POST /v1/sessions
```

**Required payload:**
```json
{
  "brain_profile_id": "opencode-acp",
  "source": "chat"
}
```

**Validation:**
- `brain_profile_id` MUST be a protocol profile (ends with `-acp`, or contains `jsonl`, `api`)
- `source` MUST be `"chat"` (never omit)
- Never set `event_mode` in request

---

## 4. Stream Filter (Hard Constraint)

**In SSE handler:**

1. Wait for first event → MUST be `session.started`
2. Read `event_mode` from it
3. If `event_mode == "terminal"` → **abort immediately**
   - Show: "Kernel mode mismatch: terminal driver for chat"
4. During streaming, if `terminal.delta` appears → **abort immediately**
   - Show: "Kernel mode mismatch: terminal output in chat session"

**No ANSI stripping. No reinterpretation. Abort only.**

---

## 5. Acceptable Events (Chat)

| Kernel Event | UI Action |
|--------------|-----------|
| `chat.delta` | Append text |
| `chat.message.completed` | Finalize |
| `tool.call` | Show tool running |
| `tool.result` | Resolve tool |
| `error` | Show error |
| `session.started` | Validate mode, then ignore |

---

## 6. Acceptance Demo (Required)

### Flow to demonstrate:

1. **Missing auth state**
   - Load model picker
   - Shows auth-required models as locked
   - Shows "Authenticate" button

2. **Auth wizard**
   - Click Authenticate → opens terminal with `auth_profile_id`
   - User completes auth in terminal
   - Status poll shows `ok`
   - Model unlocks

3. **Clean chat stream**
   - Select authenticated model
   - Send message
   - Stream shows:
     - First: `session.started`
     - Then: `chat.delta` chunks
     - Finally: `chat.message.completed`
   - **Zero `terminal.delta`**
   - **Zero ANSI in output**

---

## 7. DO NOT

- Do not strip ANSI
- Do not parse terminal bytes
- Do not add kernel driver logic
- Do not allow chat with `event_mode: "terminal"`
- Do not omit `source: "chat"`

---

## Deliverables

1. PR with:
   - Auth status API call
   - Locked model UI state
   - Terminal auth launcher
   - Strict session create payload
   - Hard stream abort on terminal.delta

2. Demo recording or screenshots showing:
   - Locked model → auth → unlocked
   - Clean chat stream (no ANSI)
   - Mode mismatch abort if triggered

**Start now. Kernel contract is stable.**