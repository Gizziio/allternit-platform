# ChatUI/API Wiring — Model Picker + Session Payload

**You are wiring ChatUI + API to support runtime-owned model selection with auth wizard separation.**

---

## Non-negotiables

- UI must not ship a hardcoded model list
- UI must not fabricate model IDs
- UI must treat model IDs as opaque strings

---

## What to Build

### 1. On model-picker open (or settings)

- Call `GET /v1/providers/auth/status` (lock/unlock providers)
- For each unlocked provider+profile:
  - Call `GET /v1/providers/:provider/models?profile_id=<profile_id>`
  - If supported: populate dropdown from response
  - If unsupported: show "manual model id" input (freeform)

### 2. Cache

- Cache per `(provider, profile_id)` with TTL = 24h
- Show "Last updated …"
- Add "Refresh" to refetch immediately

### 3. Auth Wizard Flow

- If provider auth missing/expired:
  - Show provider locked
  - "Authenticate" launches terminal session using auth profile id
  - After wizard closes: refetch auth status and unlock

### 4. Chat session create

When starting a session, send:

```json
{
  "brain_profile_id": "<selected_profile_id>",
  "source": "chat",
  "runtime_overrides": { "model_id": "<opaque-model-id>" }
}
```

If model discovery unsupported and user typed manual id, still send it as `runtime_overrides.model_id`.

### 5. Validate on send

Before creating session OR on first message:

- Call `POST /v1/providers/:provider/models/validate`
- If invalid: show suggestions; allow user to pick one; retry

### 6. Stream invariants

- Chat stream must never render terminal events
- Allowed: `session.started`, `chat.delta`, `chat.message.completed`, `tool.call`, `tool.result`, `error`
- If `terminal.delta` appears: abort + surface mismatch error

---

## Acceptance Criteria

| Test | Description |
|------|-------------|
| **A** | Locked provider → auth wizard → unlock → models load |
| **B** | Model discovery supported → dropdown works → session uses selected opaque model id |
| **C** | Discovery unsupported → manual entry → validate endpoint handles errors/suggestions |
| **D** | No stale hardcoded IDs anywhere in frontend |

---

## Deliverables

- [ ] UI changes
- [ ] API calls wired
- [ ] Session payload updated
- [ ] Cache + refresh + validate implemented

**Start now. Kernel contract is stable.**