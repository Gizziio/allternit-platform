# ChatUI/API Wiring Task — Auth Wizard + Runtime Model Selection

**Scope**
- Only change: `7-apps/api` + ChatUI frontend
- Do NOT change: kernel brain drivers / ACP driver logic
- Kernel already enforces:
  - `source="chat"` cannot use `event_mode=Terminal`
  - `source="terminal"` should only be `event_mode=Terminal` (auth wizard)
  - `session.started` now includes `source` and `event_mode` (first event)

**Goal**

Make ChatUI support:
1. Auth wizard flow (terminal PTY session)
2. Protocol chat flow (ACP / JSONL) after auth
3. Selecting provider models inside a runtime (ex: OpenCode has many models)

---

## 1) Provider Auth Awareness (Lock/Unlock UI)

### Fetch auth status

On ChatUI load (or model picker open), call kernel:
```
GET /v1/providers/auth/status
```

Use response to compute "provider locked/unlocked" and map to available chat profiles.

### UI behavior
- If provider status is `missing`/`expired` → show provider as **Locked**
- Provide **Authenticate** button for that provider
- Do not allow starting chat with locked provider

### Authenticate button flow

When clicked:
1. Create a terminal session:
   ```
   POST /v1/sessions
   ```
   with:
   - `brain_profile_id` = `<provider auth_profile_id>`
   - `source` = `"terminal"`
2. Navigate user to Terminal view attached to that session
3. When user exits terminal flow, re-check:
   ```
   GET /v1/providers/:provider/auth/status
   ```
4. If `ok` → unlock provider models + allow chat profiles

---

## 2) Chat Session Creation (Protocol Only)

When starting chat:
```
POST /v1/sessions
```
with:
- `brain_profile_id` = `<selected chat profile id>`
- `source` = `"chat"`
- include model selection override (see section 3)

### SSE stream safety contract (mandatory)

On SSE events, enforce:

**Allowed:**
- `session.started` (must be first)
- `chat.delta`
- `chat.message.completed`
- `tool.call`
- `tool.result`
- `error`

**If any `terminal.delta` arrives in a chat session:**
- Abort stream
- Show: "Kernel mode mismatch: terminal output in chat"
- Log: `{session_id, brain_profile_id, source, event_mode}`

Also validate `session.started.source === "chat"` in chat view.

---

## 3) Runtime Model Selection (OpenCode / Gemini / Kimi etc)

### Key concept

There are two selections:
- **Brain profile (runtime)**: `opencode-acp`, `gemini-acp`, `kimi-acp`, etc.
- **Model inside runtime** (provider's internal model list)

### Immediate implementation (no kernel changes required)

Add a UI field: `runtimeModelId` (string).
- Show dropdown if you have a list; otherwise show freeform input
- Persist per provider in local storage

When creating a chat session, include it in the request body as:

```json
{
  "brain_profile_id": "opencode-acp",
  "source": "chat",
  "runtime_overrides": {
    "model_id": "anthropic:claude-3-7-sonnet"
  }
}
```

If `runtime_overrides` isn't supported yet by API → add it in API proxy body unchanged; kernel can ignore until implemented. The UI contract stays stable.

### UX rules
- If provider is locked: disable model selector and show Authenticate CTA
- If provider is unlocked: allow model selection
- For OpenCode: default to a sensible `model_id` string (store it)

### Why this works

OpenCode is a router runtime; the model is not kernel-owned. ChatUI must support "brain profile + runtime model id" as the canonical pairing.

---

## 4) Acceptance Criteria (must demonstrate)

**A) Auth missing:**
- provider locked → authenticate launches terminal session → provider unlocks

**B) Kernel rejection is handled cleanly:**
- attempting to start auth profile as chat → show "use terminal auth wizard"

**C) Clean protocol chat:**
- chat session streams `chat.delta`/`chat.message.completed`
- no ANSI / no `terminal.delta` in chat view

**D) Runtime model selection:**
- user can choose "OpenCode runtime + model_id"
- `model_id` is sent in session create payload as `runtime_overrides.model_id`

---

## What you should NOT do

- Do not add tool names / provider-specific logic inside ChatUI stream parsing
- Do not assume kernel "model field" means provider model selection
- Do not create many brain profiles per OpenCode model (wrong abstraction)

---

**Start now. Kernel contract is stable.**