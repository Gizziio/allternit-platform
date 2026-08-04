---
status: done
files_changed: []
deviations: []
remaining: []
---

# Code Section Triage — Phase 1 Notes

Investigation date: 2026-08-03. Read-only re-verification of tracker rows 20–38 (`docs/SURFACE_AUDIT_SESSION_PROGRESS.md`, "Code" section) against the live codebase. No source files were modified; no builds/typechecks/dev servers were run.

**Method summary:** for every item, checked (a) whether the web component exists under `surfaces/ai.allternit.com/src/views/code/`, (b) whether it is actually reachable — imported by `shell/ViewRegistry.tsx`, registered in `nav/nav.policy.ts` / `nav/nav.types.ts`, and triggered from some rail/menu `onClick` — or whether it's orphaned code with a dispatcher case but no caller, (c) whether it calls a real backend route (`cmd/allternit-api/src/*.rs`, mounted in `main.rs`/`lib.rs`), and (d) whether any equivalent exists in `surfaces/allternit-mobile/ios/Features/Code/` (only `CodeModeView.swift` + `TerminalSessionView.swift` exist there — confirmed empty for all 19 items) or `cmd/gizzi-code/src/` (confirmed empty for all 19 items; the only "kanban" hits are an unrelated Cowork CLI label and a note telling gizzi-code users to use the platform console for the full Kanban board).

A strong pattern emerged: **roughly half of these "GAP" items are not gaps at all — they are fully-built web components that were wired into the router at some point and then orphaned** (no rail item, menu, or button anywhere calls `open()`/navigates to their route id). They are not stubs; several have real backend wiring behind them. This matters because "build iOS parity" for dead code is the wrong next step — the web reference itself needs a nav decision (resurrect vs. formally retire) before anyone ports it.

---

## 1. Code workspace (CodeRoot)

**Classification: STALE**

`views/code/CodeRoot.tsx` (6 lines) is a thin wrapper delegating to `CodeSurfaceRouter.tsx`, which branches on layout mode to `CodeThreadView.tsx` (306 lines) or `CodeCanvasView.tsx` (807 lines). Fully implemented and live — this is the root of the entire Code mode surface, lazy-loaded in `views/lazyRegistry.ts:33` and mounted as the `code` route in `shell/ViewRegistry.tsx`. The "upgrade" tag has no defined scope in the original audit.

**Next action:** No rebuild needed. If "upgrade" work is wanted, it needs its own scoped spec — nothing here is broken or missing.

## 2. Code Explorer

**Classification: STALE**

`views/code/ExplorerView.tsx` (430 lines) is live: rendered as the `explorer` tab inside `views/agent-sessions/CodeModeAgentSession.tsx:72-73` (a real, reachable right-pane tab in Code agent sessions). It is also separately registered as a standalone route (`code-explorer` in `shell/ViewRegistry.tsx:661-665`, `nav/nav.policy.ts:139`) but that standalone entry point has no rail/menu caller anywhere — only the embedded tab is reachable.

**Next action:** iOS genuinely has no equivalent, but the "GAP" framing is wrong — there's a mature reference implementation to port, reachable today via Code agent session tabs.

## 3. Code Git panel

**Classification: STALE**

Same pattern as Explorer: `views/code/GitView.tsx` (412 lines) is live via `CodeModeAgentSession.tsx:74-75` (`git` tab). Standalone `code-git` route (`ViewRegistry.tsx:666-670`, `nav.policy.ts:140`) exists but is unreachable from any menu.

**Next action:** Same as #2 — real reference implementation exists and is reachable in-session.

## 4. Code Skills view

**Classification: REAL**

`views/code/SkillsView.tsx` (59 lines) is a static mock: three hardcoded fake entries (`SKILLS` array with "React Architect", "Python Data", "Postgres Connector"), an "Install from File" button with no `onClick` handler, zero `fetch`/API calls. Registered as `code-skills` route (`ViewRegistry.tsx:681-685`, `nav.policy.ts:143`) but unreachable from any nav caller. No backend exists for a skills/plugin registry of this shape (`cmd/allternit-api/src/` has `team_skill_routes.rs` for a different feature — Team Skills panel, tracker item #90 — but nothing for per-workspace Code skills).

**Next action:** Genuinely needs building — UI and backend both. Nothing here to port other than the visual shell.

## 5. Code Project view

**Classification: STALE**

`views/code/CodeProjectView.tsx` (473 lines) is fully implemented and live, reachable two ways: the `code-project` route (`ViewRegistry.tsx:686-690`, `nav.policy.ts:136` — `allowNew: true, maxInstances: 10`) and directly from `views/project/unified/ProjectDetailRouter.tsx:22`.

**Next action:** No rebuild needed; same "undefined upgrade scope" caveat as CodeRoot.

## 6. Code Canvas (live preview split view)

**Classification: REAL**

Web side is far more mature than "PARTIAL" suggests: `views/code/CodeCanvas.tsx` (1,646 lines) + `views/code/CodeCanvasView.tsx` (807 lines), plus a whole `components/canvas/` tile subsystem (`CodeCanvasTileSession`, `CodeCanvasTileDiff`, `CodeCanvasTilePreview`, `CodeCanvasTileTerminal`, `CodeCanvasTileNotes`, `CodeCanvasTileKnowledge(Graph)`, `CodeCanvasTileExecutor`, infinite-canvas viewport, minimap, toolbar). It is the core canvas-mode surface, wired through `CodeSurfaceRouter.tsx` and `CodeThreadView.tsx:219`. iOS has nothing comparable.

**Next action:** iOS gap is real and worth building, but this is a large, multi-subsystem port (tile types, infinite canvas/viewport math, minimap, per-tile executors) — it should get its own dedicated spec rather than being folded into a generic "Code Canvas" ticket sized off the "PARTIAL" label.

## 7. Code Preview Pane

**Classification: STALE (dead code)**

`views/code/CodePreviewPane.tsx` (208 lines, has a companion `.test.tsx`) is fully written — real state via `getActiveSession`/`useCodeModeStore` and `useDrawerStore` — but has **zero references anywhere else in the repo** (not in `ViewRegistry.tsx`, not in `lazyRegistry.ts`, not imported by any other view). It is exercised only by its own unit test, never rendered in the running app.

**Next action:** Textbook dead code per the audit's own STALE definition. Before building iOS/gizzi-code parity, decide whether to wire this into the web app first (it looks otherwise ready) or retire it.

## 8. Orchestrator Center

**Classification: STALE (dead code)**

`views/code/OrchestratorCenter.tsx` (70 lines) has no references anywhere outside its own file — not routed, not lazily imported, no test.

**Next action:** Same as #7 — decide resurrect-vs-retire on web before scoping any iOS work.

## 9. Orchestration View

**Classification: STALE (dead code)**

`views/code/OrchestrationView.tsx` (156 lines) uses the real `useUnifiedStore` (`lib/agents/unified.store.ts`) but, like #8, has no references anywhere else in the repo.

**Next action:** Same as #7/#8.

## 10. Goal Control Center

**Classification: STALE (dead code)**

`views/code/GoalControlCenter.tsx` (223 lines) is the most "shovel-ready" of the orphans: it's backed by `views/code/code-goals.service.ts`, which calls real, live backend endpoints — `POST/GET /automation/goals` etc. in `cmd/allternit-api/src/automation_routes.rs:1942-1968` (mounted in `main.rs`), with a Gizzi-backend fallback path (`/v1/automations/goals`). But the component itself has no caller anywhere in the app.

**Next action:** Full stack (UI + backend) already exists and works. Wiring this into a route/nav entry is a small task, not a build.

## 11. Kanban(+DAG) Board

**Classification: STALE (dead code)**

`views/code/KanbanBoard.tsx` (536 lines) + `views/code/KanbanDAG.tsx` (503 lines) use the real `useUnifiedStore`/`DagNode` data model but have no caller anywhere in `ai.allternit.com`. Note: there is an unrelated same-named `KanbanBoard` local component in `allternit-os/components/AllternitConsole.tsx` (tracker item #111, AllternitOS demo shell) — a naming collision to be aware of, not the same feature.

**Next action:** Same resurrect-vs-retire decision as #7–#9.

## 12. Debug View

**Classification: STALE (dead/unreachable route)**

`views/code/DebugView.tsx` (458 lines) is registered as the `debug` route (`ViewRegistry.tsx:569-573`, lazy-imported at `ViewRegistry.tsx:92`) and appears in `nav/nav.types.ts`, but no rail item, menu, or button anywhere in the web app calls `open('debug')` or equivalent. Dispatcher exists; caller doesn't.

**Next action:** Substantial working code sitting behind a route nobody links to. Add a nav entry point, or explicitly retire.

## 13. Logs View

**Classification: STALE (dead code)**

`views/code/LogsView.tsx` (246 lines, uses `useUnifiedStore`) is not referenced **anywhere** — not even registered as a route in `ViewRegistry.tsx`. More disconnected than DebugView (no dispatcher at all, not just no caller).

**Next action:** Same as #7–#9, #11 — resurrect-vs-retire before any parity build.

## 14. Run Inspector

**Classification: STALE (dead code)**

`views/code/RunInspector.tsx` (124 lines) uses real `useUnifiedStore` + `useRunnerStore`/`RunnerTraceEntry` types but has no caller anywhere in the repo.

**Next action:** Same pattern as the other orphans.

## 15. Run Replay

**Classification: STALE (dead/unreachable route)**

`views/code/RunReplayView.tsx` (358 lines) calls real backend via `apiRequest`/`runtimeApiUrl` (`lib/agents/api-config`), and is registered as the `run-replay` route in `ViewRegistry.tsx:242-247` (passes `sessionId` from context) and lazily exported at `views/lazyRegistry.ts:38`. No rail item, menu, or button anywhere triggers navigation to `run-replay`.

**Next action:** Full implementation + backend wiring exists; needs a caller (e.g., a "View Replay" action on a completed run) more than a rebuild. iOS/gizzi-code still have nothing, but porting a dead route is premature — fix the web entry point first.

## 16. Tools Registry

**Classification: STALE (dead/unreachable route)**

`views/code/ToolsView.tsx` (161 lines) is registered as the `registry` route (`ViewRegistry.tsx:214-218`, lazy-loaded at `lazyRegistry.ts:37`) and is backed by a real, mounted backend: `GET /tools`, `POST /tools/execute` in `cmd/allternit-api/src/tool_routes.rs:49-50`, nested at `/api` in `main.rs:326`. No nav caller found anywhere for the `registry` route id.

**Next action:** Full stack already exists and works end-to-end. This is a nav-wiring gap, not a feature gap — cheapest of the orphans to resurrect.

## 17. Skills Registry

**Classification: DEFER**

`views/code/SkillsRegistryView.tsx` (293 lines) is registered as the `memory` route (`ViewRegistry.tsx:219-223`, lazy-loaded at `lazyRegistry.ts:40`) with no nav caller, **and** it calls `fetch('/api/v1/skills/registry')` (`SkillsRegistryView.tsx:52`) — a backend route that does not exist anywhere in `cmd/allternit-api/src/` or `cmd/allternit-cloud-api/src/`. (The `memory` route id is otherwise unrelated to the separate, real `MemoryKernelView` feature at `ViewRegistry.tsx:437` — a label collision worth avoiding in future routing, not a functional conflict.)

**Next action:** Unlike Tools Registry, this one is blocked on missing backend, not just nav wiring. Needs a backend spec before any UI wiring or iOS work is worthwhile.

## 18. Promotion Dashboard

**Classification: DEFER**

`views/code/PromotionDashboardView.tsx` (433 lines, has a `.test.tsx`) calls `fetch('/api/v1/promotion/proposals')` and `POST /api/v1/promotion/proposals/:id/decision` (`PromotionDashboardView.tsx:103,155`) — neither route exists in either backend. The component is exported from `views/lazyRegistry.ts:39` and re-exported from `index.ts`, but is **never rendered by any route** in `ViewRegistry.tsx` — it's dead in the barrel, not just unreachable.

**Next action:** Needs a backend (`/promotion/proposals` CRUD + decision endpoint) and a product decision on what "promotion" means in this context before UI wiring or an iOS/gizzi-code port make sense.

## 19. Automation Tasks (Code)

**Classification: STALE (duplicate, already shipped)**

`code-automations` route (`ViewRegistry.tsx:602-609`, rail entry in `shell/rail/code.config.ts:53-63` under "Cron", default-visible per `shell/ShellRail.tsx:221`) renders `views/cowork/AutomationTasksView.tsx` — **the exact same component** already tracked and shipped as tracker item #3 ("Automation Tasks (Goals/Routines/Loops/Cron)", PR #9, merged to main, cron jobs shipped on iOS). This is not a distinct Code-specific feature; it's the shared automation view reused in the Code rail.

**Next action:** None. Close as duplicate of #3 — same PR/finding applies.

---

## Summary

| Classification | Items |
|---|---|
| REAL | #4 Code Skills view, #6 Code Canvas |
| STALE (live & reachable) | #1 CodeRoot, #2 Code Explorer, #3 Code Git panel, #5 Code Project view |
| STALE (dead code, no caller) | #7 Preview Pane, #8 Orchestrator Center, #9 Orchestration View, #10 Goal Control Center, #11 Kanban(+DAG), #12 Debug View, #13 Logs View, #14 Run Inspector, #15 Run Replay, #16 Tools Registry |
| STALE (duplicate) | #19 Automation Tasks (Code) |
| DEFER (missing backend) | #17 Skills Registry, #18 Promotion Dashboard |

Of 19 items: 2 are real gaps worth building, 12 already exist in some form (5 live, 7 dead-but-complete-enough-to-resurrect, 1 duplicate), and 2 need backend work before any UI/iOS effort is worthwhile.
