# A2R Shell UX Acceptance Checklist
## Runtime Feedback and Streaming Experience

**Date:** 2026-02-23  
**Scope:** `7-apps/agent-shell/a2r-shell`  
**Related DAG:** `docs/_active/tui/A2R_SHELL_UX_UI_UPGRADE_DAG_2026-02-23.md`

---

## Preflight

1. `bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell typecheck`  
   Result: ✅ PASS (local)
2. `bun test --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell test/ui/status-bar-runtime.test.ts test/ui/inline-block.test.ts`  
   Result: ✅ PASS (18 tests)
3. `bun test --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell test/cli/tui/transcript.test.ts`  
   Result: ✅ PASS (16 tests)
4. Start TUI normally:
   - `bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell dev`

---

## Fixture Runs (Deterministic Latency)

### Slow tools rehearsal
1. Run:
   - `A2R_TUI_UX_FIXTURE=slow_tools A2R_TUI_UX_FIXTURE_DELAY_MS=34000 bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell dev`
2. Expected:
   - Immediate `Queued` status after Enter
   - Heartbeat updates while waiting
   - Event-first receipt lane appears before final text
   - Active tool receipts shown with overflow compaction

### Slow response rehearsal
1. Run:
   - `A2R_TUI_UX_FIXTURE=slow_response A2R_TUI_UX_FIXTURE_DELAY_MS=21000 bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell dev`
2. Expected:
   - Single active phase capsule
   - No silent gap > 800ms
   - Runtime strip advances to responding before final prose

### Silent gap simulation
1. Run:
   - `A2R_TUI_UX_FIXTURE=silent A2R_TUI_UX_FIXTURE_DELAY_MS=22000 bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell dev`
2. Expected:
   - Heartbeat and elapsed timer continue during full wait
   - No appearance of hang

---

## Metrics Mode

1. Run with metrics:
   - `A2R_TUI_UX_METRICS=1 bun run --cwd 7-apps/agent-shell/a2r-shell/packages/a2r-shell dev`
2. Expected logs (per turn):
   - `duration=...ms`
   - `first_status=...ms`
   - `first_part=...ms`
   - `first_tool=...ms`
   - `first_text=...ms`

---

## Regression Checks

1. Tool receipts:
   - No `TextNodeRenderable` crash
   - Inline and block receipts render with mixed child types
2. Interrupt UX:
   - `esc` + interrupt text still visible while busy/retrying
3. Status dialog:
   - Runtime summary includes model/provider/busy/retrying/active tools
   - Current-session token and cost metrics display when assistant turn exists

---

## Current Verification Status

- Build/type integrity: ✅ verified
- Automated regression checks: ✅ verified
- Deterministic fixture support: ✅ implemented
- Manual interactive fixture scenarios above: ⏳ pending operator run
