# ChatUI/API Wiring Task – ACP-First Kernel Sessions

**Scope**

Wire the ChatUI + API service to the kernel's ACP-first session model without adding routing logic in API. Kernel remains the authority for model routing + drivers.

**Do not touch kernel brain drivers. Do not add provider logic. Do not parse terminal output into chat.**

---

## 0) Contract Assumptions (must match kernel)

**Kernel guarantees:**
- First event is `session.started` including at minimum:
  - `session_id`
  - `event_mode` (acp|jsonl|terminal|api|local)
  - `brain_profile_id`
  - `source` (if present; if not, API still passes it)
- Chat-relevant events:
  - `chat.delta`
  - `chat.message.completed`
  - `tool.call`
  - `tool.result`
  - `error`
- Terminal-only:
  - `terminal.delta` (must never be rendered as assistant text)

**If ChatUI receives `terminal.delta` in a chat stream, treat it as kernel contract violation** (abort + surface "mode mismatch").

---

## 1) Session Create: pass source and keep kernel-owned routing

**In API service** `POST /chat` → kernel `POST /v1/sessions`:

### Required request fields to kernel
- `brain_profile_id` (selected in UI)
- `source: "chat"` (always for chat endpoint)
- optional: `thread_id` if kernel supports it
- optional: `event_mode` ONLY if UI explicitly overrides (default should come from profile/registry)

**Do not add any driver selection or provider selection in API.**

---

## 2) SSE Stream: strict event mapping

**Update the API-to-frontend event mapping to:**

### Render to chat UI only:
- `chat.delta` → `content_block_delta(text_delta)`
- `chat.message.completed` → `finish`
- `tool.call` / `tool.result` → tool panel events (or existing tool rendering)
- `error` → `finish` with error

### Never render as assistant text:
- `terminal.delta`

**If `terminal.delta` arrives:**
- Abort stream
- Emit frontend error: "Kernel mode mismatch: terminal output in chat session"
- Log structured error with `session_id`, `brain_profile_id`, `event_mode` from `session.started`

---

## 3) Gate on session.started (fail fast)

**When the SSE stream begins:**
1. Wait for first event `session.started`
2. Assert:
   - `event_mode != "terminal"` for chat
3. If assert fails:
   - abort
   - return clear error to UI:
     > "Selected brain is terminal-only; choose an ACP/JSONL brain or open Terminal view."

**This prevents silent garbage streaming.**

---

## 4) UI Model Picker behavior

**Model picker must show:**
- ACP brains (preferred)
- JSONL fallback brains
- Terminal-only brains (optional, but if shown, must be labeled "Terminal only")

**If user selects terminal-only in chat:**
- UI should block submit and prompt to switch to Terminal view.

**No hidden conversions.**

---

## 5) Tool event wiring (minimal)

**If tool events exist:**
- `tool.call` should render a "tool running" item
- `tool.result` should close it
- tool output should appear in tool panel

**Do not execute tools in API; kernel does it.**

---

## 6) Logging / Observability (must add)

**Add structured logs on API side for:**
- `session.started` (capture session_id, mode, profile)
- contract violations (`terminal.delta` in chat)
- errors (include session_id)

**This is required for debugging.**

---

## 7) Acceptance Criteria (must prove with real run)

### A) Chat session with ACP profile:
- First SSE event: `session.started`
- Subsequent: only `chat.delta` and `chat.message.completed` (+ tools)
- Zero `terminal.delta`

### B) Chat session attempting terminal profile:
- Fails fast on `session.started` mode check
- No chat text rendered
- UI shows actionable message

### C) Tool call flow (if supported):
- `tool.call` appears
- `tool.result` appears
- assistant continues

---

## Deliverables

1. **PR that:**
   - Adds `source:"chat"` to session create proxy
   - Enforces `session.started` gating in the SSE handler
   - Strict mapping: ignores/aborts on `terminal.delta` in chat
   - Updates UI labels/behavior for terminal-only brains (if necessary)

2. **A short test note:**
   - commands used
   - screenshots or logs showing:
     - `session.started` first
     - mode assertion
     - clean chat streaming

---

## Hard "DO NOT" list

- **Do not parse ANSI.**
- **Do not convert terminal output into chat.**
- **Do not add provider routing logic in API.**
- **Do not assume ACP handshake success; trust kernel events only.**
- **Do not change kernel brain driver code.**

---

**Depends on:** Kernel ACP driver implementation (Phase 1)
**Target:** API Sprint 2 (after kernel Phase 1 complete)