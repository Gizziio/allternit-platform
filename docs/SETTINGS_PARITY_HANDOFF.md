# Settings Parity Workstream — Session Handoff

> **2026-07-12 VERIFIED WORKING (playwright run against dev :3013, screenshots in scratchpad):** 19/19 functional checks pass — modal dialog overlay over live dimmed content, sidebar search filters nav, all 12 spot-checked sections render without crashes, toggle state persists across close/reopen (localStorage), `detail.section` deep-link lands on Billing, × / backdrop-click close and restore the underlying view. Embedded Allternit Plugins (PluginManager `embedded initialTab="plugins"`) renders correctly in-pane. Only console errors: 501s from unimplemented agent-ops/security backend endpoints (pre-existing; sections still render). Known non-gaps: auth-disabled build shows "Authentication is unavailable" in Account (env-specific); Customize group's Skills/Connectors overlap with the embedded PluginManager's own tabs — product tidy-up candidate.

Read this first if you have no context. Last updated: 2026-07-12 ~00:15 by the orchestrating Claude session.

> **STATUS: ALL PHASES A–D COMPLETE AND REVIEWED.** Kimi executed A–C and ~80% of D before hitting its subscription limit; a codex agent (`codex --yolo`, window CODEX-SETTINGS-PARITY-PICKUP) finished D via `docs/SETTINGS_PARITY_PHASE_D_PICKUP_TASK.md`. Final review passed: 9 files parse clean, extraction wired, persistence in use, SettingsView 2,369→1,187 lines. See `SETTINGS_PARITY_PHASE_D_NOTES.md`. Remaining backlog is post-parity work only (wire real data sources, placeholder handlers).
>
> **2026-07-12 addendum:** the overlay-vs-route question is RESOLVED — settings now renders as a true overlay in `ShellApp.tsx` (`settingsOpen` state + lazy `SettingsOverlay`, open/close events toggle it; the active view stays mounted underneath, and closing returns to it instead of forcing `chat`). The open event's `detail.section`/`detail.tab` now reach SettingsView as props (previously silently dropped), with unknown ids guarded to `signin`. The `settings` entry in ViewRegistry remains as a legacy fallback. Note: `allternit-settings-section` sessionStorage keys are written in two places but read nowhere — pre-existing dead code, left as-is.

## The goal
Bring the allternit platform's settings UI (`surfaces/ai.allternit.com/src/views/settings/`) on par with Claude Desktop's settings modal, using a screen recording of Claude Desktop as reference. Eoj's standing prefs: action over discussion, thorough cleanup not shortcuts, NEVER run builds/typechecks (they hog CPU), a2r- prefix is legacy (use allternit-).

## Key docs (all in this repo's docs/)
- `CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md` — the full spec: element-by-element mapping, section mapping, phases A–D.
- `SETTINGS_PARITY_PHASE_AB_TASK.md` / `_NOTES.md` — Phase A (modal shell, sidebar+search) + B (9 primitives in `src/components/settings/`). DONE, reviewed.
- `SETTINGS_PARITY_PHASE_C_TASK.md` / `_NOTES.md` — Phase C (all sections migrated to primitives, new Privacy/Skills/Connectors/Plugins sections, Account sessions table, usage bars). DONE, reviewed, no fixes needed.
- `SETTINGS_PARITY_PHASE_D_TASK.md` — Phase D (extract agent-ops/security dashboards from the SettingsView monolith, persist migrated state, idiom sweep on 4 external panels). RUNNING as of last update.

## Execution model
A Kimi CLI agent (window titled `KIMI-SETTINGS-PARITY d8bcad7a-189c` in Terminal.app, window id 5484, `kimi --yolo` TUI in this repo) executes each phase; the orchestrating Claude session writes the task specs, reviews every phase (verify footprint via `find src -newer docs/<TASK_FILE>`, verify claims in code, esbuild single-file parse check), fixes small bugs directly, and dispatches the next phase.

The reusable workflow is codified as a user-level skill: `~/.claude/skills/agent-orchestrator/SKILL.md`.
**Send prompts to the kimi tab focus-independently** (System Events keystrokes misfire): 
`osascript -e 'tell application "Terminal" to do script "<one-line prompt>" in tab 1 of window id 5484'` (text lands in input box), then `do script "" in tab 1 of window id 5484` to submit. Never send Ctrl-C to a kimi TUI.
Completion signal: each task spec requires kimi to write the phase `_NOTES.md`; poll for the file.

## Review state / known fixes
- Reviewer fix in Phase A (preserve): SettingsView content pane = non-scrolling `relative` wrapper holding the pinned `×` button + inner `h-full overflow-y-auto` scroller.
- Kimi fixed a real pre-existing crash: `import { useIsClient } from 'react'` → restored `useState/useEffect/useCallback`.
- Phase C verified clean: ToggleItem/DiagnosticRow deleted, 23 nav ids covered, sessions destructure correct (`usePlatformSessions()` returns `{ sessions }` object), connectors fetch guarded.
- Out of scope / do not touch: `ModelManagementView.tsx` (unrelated uncommitted changes), `views/code/*` (a second kimi session, Terminal window id 108, works there), `wizard-check.ts` (modified by another agent, flagged, left alone).
- After Phase D lands: review per the checklist in the agent-orchestrator skill (footprint → scope → claims → esbuild parse), fix small bugs inline, then report.

## Gap-closure round (2026-07-12, second half)
- **Agents/Security 501s — root cause found:** nothing listens on 127.0.0.1:8013 (the vite `/api` proxy target); the 501s are proxy failures, NOT missing UI wiring. Additionally `/api/v1/agents/operations/*` (evaluations, benchmarks/history, factory/tasks+approve/reject, gc/queue|policies|cleanup|history|agents/:name/run) was never implemented in `cmd/allternit-api` (Rust/axum — `agent_routes.rs` has no `operations` scope; the dashboards were built against a retired Next.js layer). Both panels already degrade gracefully (SecurityPanel catches → empty arrays; AgentOpsPanel falls back to sample data). Implementing the routes = a backend feature task for a future agent run (cargo builds prohibited in orchestrator sessions, so it needs its own verification path).
- **Privacy wired:** Export data now really exports (client-side JSON of all `allternit*` localStorage keys, downloads as `allternit-data-export-<date>.json`); Memory preferences closes settings and opens the `memory` view; Shared chats row REMOVED (no share feature exists anywhere in the codebase — a disabled button was misleading).
- **Skills dedupe:** new `views/settings/SkillsSettingsPanel.tsx` — Customize›Skills now lists real installed skills via `useFileSystem()` (same scanner as the capabilities manager): SettingsTable (Skill/Last updated/Author/enable-Toggle with optimistic update + rollback), working search, Refresh, Browse/Add → jumps to the Allternit Plugins section. Distinct from Platform›Allternit Plugins which (per the other session's rewrite) shows BUNDLED_SKILLS + feature plugins — installed vs bundled, no longer duplicates.

## Concurrent agents in this repo (be careful attributing changes)
Terminal windows as of last update: id 5484 kimi (settings parity), id 108 kimi (code views work), id 3540 codex, id 4165 agy, id 5414 claude (vendor-open-connector sidecar). Attribute working-tree changes by mtime vs task-file timestamps, not by assumption.
