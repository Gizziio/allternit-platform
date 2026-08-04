# Surface Audit — Session Progress Tracker

Started: 2026-08-03
Branch: `fix/review-decision-event-type` (issue #16/#19 fixes) + `docs/surface-audit-progress` (tracker updates)

**Process (same as established):** each item is re-investigated against the live codebase before any code is written. Items from the original audit that turn out to be stale or already implemented are corrected; only real, confirmed-live gaps are built.

**Legend:**
- `[ ]` Not started this session
- `[~]` Re-verification / build in progress
- `[x]` Verified and resolved (shipped, closed as stale, or documented as out-of-scope)
- `REAL` = confirmed live gap worth building
- `STALE` = audit claim was wrong; already exists, renamed, or dead code
- `DEFER` = real but intentionally out of scope / needs separate phase

---

## Core Chat/Home (3)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 1 | Projects (GAP → gizzi-code) | `[ ]` | | | |
| 2 | Artifacts Library (PARTIAL → upgrade) | `[ ]` | | | |
| 3 | Automation Tasks (Goals/Routines/Loops/Cron) (GAP → iOS) | `[x]` | PR #9 merged to main; cron jobs shipped on iOS | Closed as shipped | #9 |

## Cowork (15)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 4 | Cowork workspace (CoworkRoot) (PARTIAL → iOS) | `[ ]` | | | |
| 5 | Cowork Runs view (PARTIAL → iOS) | `[ ]` | | | |
| 6 | Cowork Drafts view (GAP → iOS) | `[ ]` | | | |
| 7 | Cowork Cron view (GAP → iOS) | `[ ]` | | | |
| 8 | Cowork Project view (GAP → gizzi-code) | `[ ]` | | | |
| 9 | Cowork Documents view (GAP → iOS) | `[ ]` | | | |
| 10 | Cowork Tables view (GAP → iOS) | `[ ]` | | | |
| 11 | Cowork Files view (GAP → iOS) | `[ ]` | | | |
| 12 | Cowork Exports view (PARTIAL → iOS) | `[ ]` | | | |
| 13 | Cowork Insights panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 14 | Cowork Activity panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 15 | Cowork Goals panel (PARTIAL → iOS) | `[ ]` | | | |
| 16 | Cowork Wiki section viewer (PARTIAL → iOS) | `[ ]` | | | |
| 17 | Cowork Audit log viewer (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 18 | Intelli-Schedule panel (GAP → iOS) | `[ ]` | | | |
| 19 | Harness Config panel (GAP → iOS) | `[ ]` | | | |

## Code (17)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 20 | Code workspace (CodeRoot) (PARTIAL → upgrade) | `[x]` | STALE — fully implemented, live (`CodeRoot.tsx`→`CodeSurfaceRouter.tsx`→`CodeThreadView`/`CodeCanvasView`) | Closed as stale; no defined "upgrade" scope | |
| 21 | Code Explorer (GAP → iOS) | `[x]` | STALE — `ExplorerView.tsx` (430 lines) live via `CodeModeAgentSession.tsx` explorer tab | Closed as stale; iOS port has a real reference impl | |
| 22 | Code Git panel (GAP → iOS) | `[x]` | STALE — `GitView.tsx` (412 lines) live via `CodeModeAgentSession.tsx` git tab | Closed as stale; iOS port has a real reference impl | |
| 23 | Code Skills view (GAP → iOS) | `[x]` | REAL — `SkillsView.tsx` is a static 3-item mock, no backend, unreachable route | Confirmed gap; needs UI + backend built | |
| 24 | Code Project view (PARTIAL → upgrade) | `[x]` | STALE — `CodeProjectView.tsx` (473 lines) live via `code-project` route + `ProjectDetailRouter.tsx` | Closed as stale; no defined "upgrade" scope | |
| 25 | Code Canvas (live preview split view) (PARTIAL → iOS) | `[x]` | REAL (iOS gap) — web ref is mature (`CodeCanvas.tsx` 1646 lines + `CodeCanvasView.tsx` 807 lines + tile subsystem), iOS has none | Confirmed gap; large port, needs own dedicated spec | |
| 26 | Code Preview Pane (GAP → iOS, gizzi-code) | `[x]` | STALE (dead code) — `CodePreviewPane.tsx` (208 lines) fully written, zero callers anywhere | Resurrect-or-retire decision needed before iOS port | |
| 27 | Orchestrator Center (PARTIAL → iOS) | `[x]` | STALE (dead code) — `OrchestratorCenter.tsx` (70 lines), no callers anywhere | Resurrect-or-retire decision needed | |
| 28 | Orchestration View (PARTIAL → iOS) | `[x]` | STALE (dead code) — `OrchestrationView.tsx` (156 lines), uses real `useUnifiedStore`, no callers | Resurrect-or-retire decision needed | |
| 29 | Goal Control Center (GAP → iOS) | `[x]` | STALE (dead code) — `GoalControlCenter.tsx` backed by live `/automation/goals` API, no callers | Shovel-ready; just needs nav wiring | |
| 30 | Kanban(+DAG) Board (GAP → iOS) | `[x]` | STALE (dead code) — `KanbanBoard.tsx`+`KanbanDAG.tsx` (536+503 lines), no callers | Resurrect-or-retire decision needed | |
| 31 | Debug View (PARTIAL → iOS) | `[x]` | STALE (dead/unreachable route) — `DebugView.tsx` (458 lines) registered as `debug` route, no nav caller | Needs a nav entry point, or retire | |
| 32 | Logs View (PARTIAL → iOS) | `[x]` | STALE (dead code) — `LogsView.tsx` (246 lines), not even registered as a route | Resurrect-or-retire decision needed | |
| 33 | Run Inspector (PARTIAL → iOS) | `[x]` | STALE (dead code) — `RunInspector.tsx` (124 lines), uses real stores, no callers | Resurrect-or-retire decision needed | |
| 34 | Run Replay (GAP → iOS, gizzi-code) | `[x]` | STALE (dead/unreachable route) — `RunReplayView.tsx` registered as `run-replay` route w/ real backend calls, no nav caller | Needs a caller (e.g. "View Replay" action) before porting | |
| 35 | Tools Registry (PARTIAL → iOS) | `[x]` | STALE (dead/unreachable route) — `ToolsView.tsx` registered as `registry` route, backed by live `/tools` API, no nav caller | Cheapest orphan to resurrect; full stack works | |
| 36 | Skills Registry (GAP → iOS) | `[x]` | DEFER — `SkillsRegistryView.tsx` (293 lines) unreachable route, calls nonexistent `/api/v1/skills/registry` | Needs backend spec before UI wiring or iOS work | |
| 37 | Promotion Dashboard (GAP → iOS, gizzi-code) | `[x]` | DEFER — `PromotionDashboardView.tsx` never routed at all, calls nonexistent `/api/v1/promotion/proposals` | Needs backend + product decision on scope | |
| 38 | Automation Tasks (Code) (GAP → iOS) | `[x]` | STALE — duplicate of #3; `code-automations` route renders the same `AutomationTasksView` already shipped in PR #9 | Closed as duplicate | #9 |

## ACI/Browser (8)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 39 | ACI Browser surface (GAP → gizzi-code) | `[ ]` | | | |
| 40 | Mini-apps Store (GAP → iOS) | `[ ]` | | | |
| 41 | Mini-app frame/runtime (GAP → iOS) | `[ ]` | | | |
| 42 | Office Add-ins — Word (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 43 | Office Add-ins — Excel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 44 | Office Add-ins — PowerPoint (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 45 | Office & Extensions view (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 46 | Operator Browser (GAP → gizzi-code) | `[ ]` | | | |

## Design/Creative (13)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 47 | Design Mode — Questions tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 48 | Design Mode — Mobile tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 49 | Design Mode — Docs tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 50 | Design Mode — Handoff tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 51 | Design Mode — Graph tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 52 | Design Mode — Pipeline tab (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 53 | Design Marketplace/Registry (GAP → iOS) | `[ ]` | | | |
| 54 | Design Compare (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 55 | Form Surfaces (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 56 | Canvas Protocol (PARTIAL → iOS) | `[ ]` | | | |
| 57 | Design Team Workspace (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 58 | Content Pipeline (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 59 | Live Artifact Editor (PARTIAL → upgrade) | `[ ]` | | | |

## Terminal/Infra (11)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 60 | Monitor (GAP → iOS) | `[ ]` | | | |
| 61 | Runtime Operations (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 62 | Budget Dashboard (PARTIAL → iOS) | `[ ]` | | | |
| 63 | Replay Manager (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 64 | Prewarm Manager (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 65 | Nodes (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 66 | Cloud Deploy (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 67 | Capsule Manager (GAP → iOS) | `[ ]` | | | |
| 68 | VPS & Servers panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 69 | Cloud Instances panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 70 | Enterprise BYOC panel (GAP → iOS, gizzi-code) | `[ ]` | | | |

## DAG suite (15)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 71 | DAG Integration Page (PARTIAL → upgrade) | `[ ]` | | | |
| 72 | Ontology Viewer (GAP → gizzi-code) | `[ ]` | | | |
| 73 | Directive Compiler (GAP → gizzi-code) | `[ ]` | | | |
| 74 | GC Agents (GAP → gizzi-code) | `[ ]` | | | |
| 75 | Receipts Viewer (GAP → gizzi-code) | `[ ]` | | | |
| 76 | Security Dashboard (GAP → gizzi-code) | `[ ]` | | | |
| 77 | Purpose Binding (GAP → gizzi-code) | `[ ]` | | | |
| 78 | Observability Dashboard (PARTIAL → upgrade) | `[ ]` | | | |
| 79 | Multimodal Input (GAP → gizzi-code) | `[ ]` | | | |
| 80 | Evolution Layer (GAP → gizzi-code) | `[ ]` | | | |
| 81 | Context Control Plane (GAP → gizzi-code) | `[ ]` | | | |
| 82 | Swarm ADE (PARTIAL → iOS) | `[ ]` | | | |
| 83 | H5I panel — Audit (GAP → gizzi-code) | `[ ]` | | | |
| 84 | H5I panel — Commit (PARTIAL → upgrade) | `[ ]` | | | |
| 85 | H5I panel — Context (GAP → gizzi-code) | `[ ]` | | | |
| 86 | H5I panel — Diff (PARTIAL → upgrade) | `[ ]` | | | |
| 87 | Changeset Review (GAP → iOS) | `[x]` | PR #4 merged to main | Closed as shipped | #4 |

## Marketplace/Plugins (4)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 88 | Marketplace (top-level) (PARTIAL → iOS) | `[ ]` | | | |
| 89 | Plugin Registry / Plugin Marketplace (PARTIAL → iOS) | `[ ]` | | | |
| 90 | Team Skills panel (GAP → iOS) | `[ ]` | | | |
| 91 | MiroFish simulation engine (GAP → iOS, gizzi-code) | `[ ]` | | | |

## Products/Discovery (5)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 92 | Products Discovery (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 93 | A://Labs (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 94 | Udemy Catalog (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 95 | Discovery Feed (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 96 | Research tab/panel (PARTIAL → iOS) | `[ ]` | | | |

## Mail/Knowledge (3)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 97 | Mail Monitor (GAP → iOS) | `[ ]` | | | |
| 98 | Documents (office-file I/O) (GAP → iOS) | `[ ]` | | | |
| 99 | Knowledge (PARTIAL → iOS) | `[ ]` | | | |

## Onboarding/Account (10)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 100 | Settings (umbrella/shell) (PARTIAL → upgrade) | `[ ]` | | | |
| 101 | Settings > Account (PARTIAL → gizzi-code) | `[ ]` | | | |
| 102 | Settings > Platform (PARTIAL → iOS) | `[ ]` | | | |
| 103 | Settings > Products (GAP → iOS) | `[ ]` | | | |
| 104 | Settings > Infrastructure (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 105 | Settings > Customize (PARTIAL → upgrade) | `[ ]` | | | |
| 106 | Device Pairing panel (GAP → iOS) | `[x]` | PR #5 merged to main | Closed as shipped | #5 |
| 107 | Organization Access panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 108 | Compute Billing panel (GAP → iOS) | `[ ]` | | | |
| 109 | Enterprise BYOC panel (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 110 | Model Management view (PARTIAL → upgrade) | `[ ]` | | | |

## AllternitOS (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 111 | AllternitOS (GAP → gizzi-code) | `[ ]` | | | |

## Playground/QA (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 112 | Playground (PARTIAL → iOS) | `[ ]` | | | |

## Empty stubs (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 113 | `views/gizzi`, `components/mesh`, `lib/mesh-network` (PARTIAL → upgrade) | `[ ]` | | | |

## Desktop-only (2)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 114 | Local runtime discovery (PARTIAL → upgrade) | `[ ]` | | | |
| 115 | Local Python execution (PARTIAL → upgrade) | `[ ]` | | | |

## gizzi-code-only (5)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 116 | `github ...` GitHub Actions agent bot (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 117 | Local VM management (GAP → gizzi-code) | `[ ]` | | | |
| 118 | Teleport / remote dev environments (GAP → gizzi-code) | `[ ]` | | | |
| 119 | Slack app install (GAP → gizzi-code) | `[ ]` | | | |
| 120 | Theme switching (`/theme`) (PARTIAL → upgrade) | `[ ]` | | | |
