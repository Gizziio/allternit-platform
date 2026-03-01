# A2R Shell UX/UI Upgrade DAG
## Realtime Chat Experience (No-Silence Runtime)

**Date:** 2026-02-23  
**Status:** ✅ EXECUTED (automated closeout complete)  
**Scope:** `7-apps/agent-shell/a2r-shell`  
**Goal:** Remove perceived hangs and ship an A2R-native runtime UX with instant feedback.

---

## Success Metrics (Definition of Done)

1. **Time-to-first-visual (TTFV):** <= 200ms after Enter.
2. **Single active phase:** only one phase label visible at a time.
3. **No silent gap:** heartbeat/progress update at least every 800ms while waiting.
4. **Streaming-first output:** assistant text starts immediately on first delta, not after note wrappers.
5. **Stable rendering:** no `TextNodeRenderable` runtime errors from inline block rendering.
6. **Brand surface control:** all new user-facing UX literals routed via `src/brand/copy.ts`.

---

## DAG Overview

| ID | Task | Effort | Dependencies | Priority | Status |
|----|------|--------|--------------|----------|--------|
| UX-001 | Instrument response timeline metrics | 0.5d | None | P0 | ✅ COMPLETE |
| UX-002 | Add synthetic delayed-stream test fixtures | 0.5d | None | P0 | ✅ COMPLETE |
| UX-101 | Instant submit acknowledgment (queued + timer start) | 1d | UX-001 | P0 | ✅ COMPLETE |
| UX-102 | Single active phase resolver (strict priority map) | 1d | UX-001 | P0 | ✅ COMPLETE |
| UX-103 | No-silence heartbeat lane (live updates during wait) | 1d | UX-101 | P0 | ✅ COMPLETE |
| UX-201 | Event-first render lane (phase/tool receipts before answer) | 1.5d | UX-102 | P1 | ✅ COMPLETE |
| UX-202 | Streaming-first assistant text path (remove blocking note path) | 1d | UX-201 | P0 | ✅ COMPLETE |
| UX-203 | Runtime trace compaction rules (short, rolling, readable) | 1d | UX-103, UX-201 | P1 | ✅ COMPLETE |
| UX-301 | Mode strip redesign (`thinking`, `web`, `tools`, `responding`) | 1d | UX-102 | P1 | ✅ COMPLETE |
| UX-302 | `/status`-style runtime panel (context/tokens/tools/model) | 1d | UX-301 | P2 | ✅ COMPLETE |
| UX-401 | A2R copy/literals sweep for TUI chat surfaces | 1d | UX-202 | P1 | ✅ COMPLETE |
| UX-402 | Inline block hardening for OpenTUI text node safety | 0.5d | UX-202 | P0 | ✅ COMPLETE |
| UX-403 | End-to-end UX regression tests + acceptance checklist | 1d | UX-203, UX-302, UX-401, UX-402 | P0 | ✅ COMPLETE |

**Total Effort:** ~11 days (2-2.5 weeks, one engineer)

---

## Dependency Graph

```text
UX-001 ──┬──> UX-101 ──> UX-103 ──┬──> UX-203 ───┐
         └──> UX-102 ──┬──> UX-201 ──> UX-202 ─┬──> UX-401 ─┐
                        │                       └──> UX-402 ─┼──> UX-403
                        └──> UX-301 ──> UX-302 ──────────────┘

UX-002 ────────────────────────────────────────────────────────> UX-403
```

---

## Task Details

### UX-001: Instrument response timeline metrics
**Objective:** measure real and perceived latency before changing UX.

**Subtasks**
- Add per-turn timestamps: submit, first phase paint, first tool event, first text delta, final.
- Emit metrics to debug/log surface for local verification.
- Capture p50/p95 in dev run summary.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/component/prompt/index.tsx`

**Acceptance**
- Metrics are visible per turn.
- Can prove TTFV and first-delta latency without external tooling.

---

### UX-002: Add synthetic delayed-stream test fixtures
**Objective:** reliably reproduce “21-34s delayed response” UX in development.

**Subtasks**
- Add fixtures that delay model text while still emitting tool/phase events.
- Add one fixture with no tool events to test heartbeat fallback.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/session/prompt.ts`

**Acceptance**
- Delay scenarios can be replayed deterministically.

---

### UX-101: Instant submit acknowledgment (queued + timer start)
**Objective:** never show a blank wait after user sends a prompt.

**Subtasks**
- Render immediate `queued`/`connecting` receipt at submit time.
- Start elapsed timer at submit, not first assistant part.
- Keep visible until first real runtime event arrives.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`

**Acceptance**
- First visual response appears <= 200ms after Enter.

---

### UX-102: Single active phase resolver
**Objective:** show one truthful current phase only.

**Subtasks**
- Implement strict phase priority resolver.
- Resolve collisions (`reasoning` + `tool`) to one active phase.
- Keep retry mapped to `connecting`.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/status-bar.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`

**Acceptance**
- UI never shows multiple simultaneous phase chips for one turn.

---

### UX-103: No-silence heartbeat lane
**Objective:** continuously reassure progress during model/tool latency.

**Subtasks**
- Add heartbeat/pulse updates every 400-800ms when no new deltas arrive.
- Show contextual hint (`waiting on tool`, `awaiting model delta`, etc.).
- Keep timer visible in same lane.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/spinner.tsx`

**Acceptance**
- No silent period longer than 800ms while session is active.

---

### UX-201: Event-first render lane
**Objective:** render runtime activity before final prose.

**Subtasks**
- Stream phase/tool receipts immediately on event arrival.
- Separate runtime lane from final assistant text lane.
- Preserve order by event timestamp.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/inline-block.tsx`

**Acceptance**
- Tool/phase receipts appear before long-delayed text responses.

---

### UX-202: Streaming-first assistant text path
**Objective:** avoid blocking final answer rendering behind wrapper labels.

**Subtasks**
- Remove any path that waits for full note block before text paint.
- Flush text deltas at a short cadence (<=100ms) while preserving markdown integrity.
- Keep reasoning optional and non-blocking.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`

**Acceptance**
- First assistant text chunk displays immediately on first delta.

---

### UX-203: Runtime trace compaction rules
**Objective:** keep live trace useful without flooding terminal space.

**Subtasks**
- Keep only recent N runtime lines visible.
- Collapse repetitive events (`same tool + same phase`) into compact counts.
- Preserve full detail in expandable receipt blocks.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`

**Acceptance**
- Runtime trace remains readable in long runs.

---

### UX-301: Mode strip redesign
**Objective:** make active mode obvious at a glance.

**Subtasks**
- Show active mode as single highlighted capsule.
- Inactive modes are muted toggles (not equal visual weight).
- Keep labels aligned with A2R copy system.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/component/prompt/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/brand/copy.ts`

**Acceptance**
- Users can identify active mode in <1 second without reading trace lines.

---

### UX-302: `/status`-style runtime panel
**Objective:** expose live operational context (trust surface).

**Subtasks**
- Show model, provider, context usage, active tools, elapsed, and current phase.
- Add keybind/command entry for quick open.
- Keep updates lightweight (debounced).

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/component/dialog-status.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/component/prompt/index.tsx`

**Acceptance**
- Status panel opens instantly and reflects current turn state.

---

### UX-401: A2R copy/literals sweep
**Objective:** remove remaining OpenCode-era mental-model wording from active chat surfaces.

**Subtasks**
- Move remaining literals in session/prompt/sidebar dialogs into `A2RCopy`.
- Standardize terms: `Context Pack`, `Runtime`, `Receipts`, `Checkpoint`.
- Verify no hardcoded chat-surface labels remain in targeted files.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/brand/copy.ts`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/sidebar.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`

**Acceptance**
- Targeted surfaces read as A2R-native vocabulary.

---

### UX-402: Inline block safety hardening
**Objective:** prevent non-string renderables from crashing OpenTUI text nodes.

**Subtasks**
- Keep strict string coercion for inline content.
- Add guardrails for object/function children.
- Add regression checks around `A2RInlineBlock`.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/inline-block.tsx`

**Acceptance**
- No `TextNodeRenderable` crash in tool/receipt rendering paths.

---

### UX-403: End-to-end regression + acceptance run
**Objective:** prove the upgraded UX is stable and visibly faster.

**Subtasks**
- Run delayed-stream fixtures and normal sessions.
- Validate all success metrics and record before/after numbers.
- Capture terminal screenshots/gifs for release notes.

**Primary Files**
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/cli/cmd/tui/routes/session/index.tsx`
- `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/status-bar.tsx`

**Acceptance**
- All six Success Metrics pass.
- No regressions in prompt submission, tool rendering, or interrupts.

**Completion Evidence (2026-02-23)**
- `bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell typecheck` ✅
- `bun test --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell test/ui/status-bar-runtime.test.ts test/ui/inline-block.test.ts` ✅
- `bun test --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell test/cli/tui/transcript.test.ts` ✅
- Added regression coverage:
  - `7-apps/agent-shell/a2r-shell/packages/a2r-shell/test/ui/status-bar-runtime.test.ts`
  - `7-apps/agent-shell/a2r-shell/packages/a2r-shell/test/ui/inline-block.test.ts`
- Added extracted helper modules to keep UX resolver/coercion logic testable without TSX runtime:
  - `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/status-runtime.ts`
  - `7-apps/agent-shell/a2r-shell/packages/a2r-shell/src/ui/a2r/inline-coerce.ts`

---

## Execution Plan (Recommended)

### Wave 1 (P0, 3-4 days)
`UX-001`, `UX-002`, `UX-101`, `UX-102`, `UX-103`, `UX-202`, `UX-402`

### Wave 2 (P1, 4-5 days)
`UX-201`, `UX-203`, `UX-301`, `UX-401`

### Wave 3 (P2/P0 closeout, 2 days)
`UX-302`, `UX-403`

---

## Notes

- This DAG is intentionally scoped to UX behavior and presentation, not model/provider compute speed.
- The primary user-facing win is **continuous truthful progress rendering** from submit to completion.
- Dev fixture controls are now available for deterministic latency rehearsal:
  - `A2R_TUI_UX_FIXTURE=slow_tools|slow_response|silent`
  - `A2R_TUI_UX_FIXTURE_DELAY_MS=22000` (default if unset/invalid)
  - `A2R_TUI_UX_METRICS=1` to print per-turn latency checkpoints
- Manual operator fixture walkthrough is still recommended before release screenshots/GIF capture.
