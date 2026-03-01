# A2rchitech Session Summary — ShellUI Brain Runtime + UI Integration + E2E QA

**Date:** 2026-01-26 (America/Chicago)  
**Topic:** ShellUI agent-native chat UI on top of Brain Runtime sessions; integration + hardening; E2E QA prompt.

---

## 1) Product Direction Decision: Fork vs Rebuild

- Initial idea: fork an OSS chat interface (e.g., LobeChat vs Open WebUI) and wire its functionality into A2rchitech.
- Conclusion: **avoid forking for core product** if proprietary branding + long-term maintainability matter.
  - Use OSS projects as **reference implementations** (UX patterns + feature checklist), but implement capabilities in A2rchitech’s own **Brain Session** contract.
- Reason: reduce licensing/branding constraints, avoid inheriting framework coupling, and keep a stable internal API boundary.

---

## 2) Core Architecture: “Everything is a Brain Session”

A unified **Brain Runtime** design where a “model” can be:

- **Native API adapter**: Claude/Gemini/OpenAI/Qwen, etc.
- **Local runtime**: Ollama / vLLM / llama.cpp
- **CLI agent process**: Claude Code, Gemini CLI, Qwen CLI wrapper, Codex CLI (if used)

### Key principles
- **Single frontend contract**: UI talks only to the Brain Gateway (Responses/OpenResponses-shaped streaming).
- **Stateful sessions**: kernel moves from one-off calls to resumable, streaming sessions.
- **Dual-stream UX**:
  - Chat stream = narrative output
  - Console drawer = raw terminal/log stream

---

## 3) Backend Capabilities Spec (Brain Gateway + Orchestrator + Router)

### Brain Gateway (single contract to frontend)
- `POST /v1/sessions`
- `GET /v1/sessions/:id/events` (SSE)
- `POST /v1/sessions/:id/input`
- `GET /v1/brain/profiles`
- `POST /v1/brain/route`

### Session Orchestrator
- Select runtime type (api/local/cli)
- Spawn CLI under PTY with sandboxing + workspace dir
- Create API clients + local runtime connectors
- Normalize outputs into a single event stream

### Model Router (policy engine)
- Stores **Brain Profiles** (capabilities, cost, privacy)
- Produces **Brain Plans**:
  - primary selection
  - fallbacks
  - blockers (missing binary, missing key, missing model, missing deps)

### Capability Registry (OpenRouter-like)
Per brain profile:
- `type: api|cli|local`
- capability flags (tools, vision, long_context, code, json_mode, fast_stream)
- requirements (api_key, binary_path, model_downloaded, deps)
- install + auth recipes (deep links + scripts)
- healthcheck

---

## 4) UX Flows Required

### A) First open / onboarding (Brain Setup Wizard)
- Detect OS + shell + permissions.
- Offer three paths:
  1) Cloud API brain (enter key + test)
  2) Local brain (install runtime/model + test)
  3) CLI brain (install deps + CLI + test)
- Store default brain + fallback chain.

### B) Homepage “Run an Agent”
- Start brain session explicitly (CLI auto-opens console drawer).

### C) Chat send with no agent selected
- Do **not** stub response.
- Backend emits `brain.required`.
- UI shows “Choose Brain” card:
  - Auto Router
  - Connect API
  - Install CLI
  - Use Local
- After selection: **replay the original message automatically**.

---

## 5) ShellUI UI Build: Required Frontend Features

### Core wiring
- Session-aware stores:
  - `SessionStore` (SSE attach, dedupe, reconnect, lifecycle)
  - `BrainStore` (profiles + route plans)
- Message rendering as **parts**, not flat text:
  - streaming text
  - tool calls/results (collapsible)
  - artifacts
  - (optional) terminal preview blocks
- Console drawer terminal:
  - global mount
  - subscribes to active session
  - auto-open on first `terminal.delta` for CLI sessions

### Expected UX polish
- message states (sending/streaming/done/error)
- retry/regenerate/stop
- thread list features (rename/pin/search)
- clear, non-raw error blocks
- router transparency (capabilities + fallbacks + blockers + deep links)

---

## 6) Integration Bridge (No Rewrite)

Problem: new UI components existed but weren’t integrated into real ShellUI entry points.

Solution: **Adapter layer** approach:

- `ChatInterface.tsx` keeps legacy signature but renders new `ChatView`.
- `ConsoleDrawer` becomes global and binds to `activeSessionId` via a tiny UI store.
- `BrainContextAdapter.tsx` preserves old BrainContext interface while delegating to BrainStore.
- `conversationSync.ts` keeps legacy ConversationStore previews and thread metadata updated from SessionStore events.
- `ChatStorageAdapter.ts` bridges legacy persistence as needed without creating a second writer.

Key principle: **one source of truth** for message content; everything else derived.

---

## 7) Production Hardening Requirements

Hardening deliverables and proof expectations:

- `TRUTH_SOURCES.md`: single write owners per entity (threads/messages/status/transcripts).
- `EVENT_MODEL.md`: dedupe strategy + boundary conditions + reconnect behavior.
- `SHELL_UI_TREE.md`: real mounted entry + root layout + where Chat + Drawer live.
- `CONSOLE_DRAWER_RULES.md`: CLI vs API behavior.
- `SHELLUI_CHAT_VERIFY.md`: pass/fail test matrix.
- SSE instrumentation: open/close counts, leak detection, duplicate drop stats.
- `DiagnosticPanel.tsx`: runs verification matrix + exports artifacts.

“Death tests” emphasized:
1) thread-switch leak test (many switches; SSE count stable)
2) reconnect mid-stream (no dup, no double-complete)
3) CLI lifecycle (PTY terminates on close; no zombie sessions)

---

## 8) E2E Website QA: Agent Prompt Pattern

A deterministic e2e QA prompt was produced to make an agent:

- Inventory every page + widget
- Enforce stable selectors (`data-testid`)
- Create a test matrix mapping every inventory item → test ID
- Implement Playwright tests (smoke + regression + a11y basics)
- Run tests and export artifacts (HTML report, screenshots, videos, traces)
- Produce defect report with repro steps + artifact paths
- Fail build if inventory items lack tests, and fail on console errors/network failures (unless allowlisted)

---

## Notes

- A “prompt for the agent to look for something” was noted during the session, but it was not the primary focus of this summary; the primary work was defining and executing the ShellUI Brain Session UI architecture + integration + hardening, and producing the e2e QA agent prompt.
