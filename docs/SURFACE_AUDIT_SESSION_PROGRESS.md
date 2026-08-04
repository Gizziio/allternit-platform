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

---

**Tracker correction (this session):** the original audit tracker incorrectly marked every item `[x]` after triage. `[x]` now means the item is *resolved* (shipped, stale, or deferred/documented). REAL items that still need building are `[ ]` (pending) or `[~]` (active).

## Core Chat/Home (3)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 1 | Projects (GAP → gizzi-code) | `[x]` | STALE — project model already exists: web `views/ProjectView.tsx`, gizzi-code `project/instance.ts`, iOS `Features/Projects/` | Closed as stale | |
| 2 | Artifacts Library (PARTIAL → upgrade) | `[x]` | STALE — web `views/library/LibraryView.tsx` ("Artifacts Library") + iOS `Features/Artifacts/Views/ArtifactsLibraryView.swift` both exist | Closed as stale | |
| 3 | Automation Tasks (Goals/Routines/Loops/Cron) (GAP → iOS) | `[x]` | PR #9 merged to main; cron jobs shipped on iOS | Closed as shipped | #9 |

## Cowork (15)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 4 | Cowork workspace (CoworkRoot) (PARTIAL → iOS) | `[x]` | REAL — phase 1 shipped: launchpad + active-session shell + progress panel on iOS (`feat/ios-cowork-workspace`) | Shipped phase 1; phase 2/3 deferred | `feat/ios-cowork-workspace` |
| 5 | Cowork Runs view (PARTIAL → iOS) | `[x]` | STALE — RunsView.tsx registered but zero dispatchers in Cowork nav; only reachable via unrelated Products Discovery "Workflows" card | close (defer if re-scoped) | |
| 6 | Cowork Drafts view (GAP → iOS) | `[x]` | STALE — DraftsView.tsx registered, zero dispatchers anywhere; dead code | close | |
| 7 | Cowork Cron view (GAP → iOS) | `[x]` | STALE — renamed/merged into Automation Tasks (live, reachable via shared Home rail); iOS Automation Tasks itself absent from this checkout despite PR #9 claims | close; reconcile iOS branch state | |
| 8 | Cowork Project view (GAP → gizzi-code) | `[x]` | REAL — phase 1 shipped: `cowork-project` command lists Cowork projects, shows tasks by project, and creates tasks (`feat/gizzi-cowork-project`) | Shipped phase 1; phase 2/3 deferred | `feat/gizzi-cowork-project` |
| 9 | Cowork Documents view (GAP → iOS) | `[x]` | STALE — DocumentsView.tsx only reachable via unrelated Code-mode Skills Registry path, not Cowork nav | close (defer if re-scoped) | |
| 10 | Cowork Tables view (GAP → iOS) | `[x]` | STALE — TablesView.tsx registered, zero dispatchers; dead code | close | |
| 11 | Cowork Files view (GAP → iOS) | `[x]` | STALE — FilesView.tsx registered, zero dispatchers; dead code | close | |
| 12 | Cowork Exports view (PARTIAL → iOS) | `[x]` | STALE — ExportsView.tsx registered, zero dispatchers; dead code on web | close (defer if re-scoped) | |
| 13 | Cowork Insights panel (GAP → iOS, gizzi-code) | `[x]` | STALE — InsightsView.tsx registered, zero dispatchers; dead code on web too | close (defer if re-scoped) | |
| 14 | Cowork Activity panel (GAP → iOS, gizzi-code) | `[x]` | STALE — ActivityView.tsx registered, zero dispatchers; dead code | close | |
| 15 | Cowork Goals panel (PARTIAL → iOS) | `[x]` | STALE — GoalsView.tsx dead; real goals UI is a tab inside AutomationTasksView (duplicate of item #7) | close | |
| 16 | Cowork Wiki section viewer (PARTIAL → iOS) | `[x]` | STALE (recategorize) — WikiSectionViewer.tsx real/live but mounted app-wide via ArtifactSidecar, not Cowork nav | close under Cowork; defer under Artifacts Library | |
| 17 | Cowork Audit log viewer (GAP → iOS, gizzi-code) | `[x]` | STALE — AuditLogViewer.tsx only rendered inside dead TasksView.tsx; transitively unreachable | close (defer if re-scoped) | |
| 18 | Intelli-Schedule panel (GAP → iOS) | `[x]` | REAL — phase 1 shipped: Swift `IntelliScheduleEngine`, `IntelliScheduleStore`, `IntelliSchedulePanel`, entry from Cowork-mode chrome (`feat/ios-intelli-schedule`) | Shipped phase 1 | `feat/ios-intelli-schedule` |
| 19 | Harness Config panel (GAP → iOS) | `[x]` | STALE (recategorize) — HarnessConfigPanel.tsx real/live but mounted in OperatorBrowserView/DesignModeView, not Cowork | close under Cowork; defer under Operator/Design | |

## Code (17)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 20 | Code workspace (CodeRoot) (PARTIAL → upgrade) | `[x]` | STALE — fully implemented, live (`CodeRoot.tsx`→`CodeSurfaceRouter.tsx`→`CodeThreadView`/`CodeCanvasView`) | Closed as stale; no defined "upgrade" scope | |
| 21 | Code Explorer (GAP → iOS) | `[x]` | STALE — `ExplorerView.tsx` (430 lines) live via `CodeModeAgentSession.tsx` explorer tab | Closed as stale; iOS port has a real reference impl | |
| 22 | Code Git panel (GAP → iOS) | `[x]` | STALE — `GitView.tsx` (412 lines) live via `CodeModeAgentSession.tsx` git tab | Closed as stale; iOS port has a real reference impl | |
| 23 | Code Skills view (GAP → iOS) | `[x]` | REAL — web `SkillsView.tsx` now fetches `/api/v1/team-skills`; iOS `CodeSkillsView` + `TeamSkillsClient` + store shipped (`feat/ios-code-skills`) | Shipped phase 1 | `feat/ios-code-skills` |
| 24 | Code Project view (PARTIAL → upgrade) | `[x]` | STALE — `CodeProjectView.tsx` (473 lines) live via `code-project` route + `ProjectDetailRouter.tsx` | Closed as stale; no defined "upgrade" scope | |
| 25 | Code Canvas (live preview split view) (PARTIAL → iOS) | `[x]` | REAL — phase 1 shipped: workspace shell + session tile grid + entry from CodeModeView (`feat/ios-code-canvas`). Full infinite canvas, drag/resize, non-session tiles deferred. | Shipped phase 1 | `feat/ios-code-canvas` |
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
| 39 | ACI Browser surface (GAP → gizzi-code) | `[x]` | DEFER — web+iOS fully implemented (ACITabView/ACIWebBrowserView); gizzi-code is a CLI, no GUI surface to port to | Deferred — CLI/GUI mismatch | |
| 40 | Mini-apps Store (GAP → iOS) | `[x]` | REAL — phase 1 shipped: browse-only store with community catalog + public MCP registry, search, categories, pin/unpin, Safari open (`feat/ios-mini-apps-store`) | Shipped phase 1; install/start/runtime/embedded-web deferred | `feat/ios-mini-apps-store` |
| 41 | Mini-app frame/runtime (GAP → iOS) | `[x]` | REAL — phase 1 shipped: `MiniAppRuntimeView` WKWebView host + capabilities placeholder, wired from store Open button (`feat/ios-mini-app-runtime`) | Shipped phase 1; agent harness/ACP spawn/JS bridge deferred | `feat/ios-mini-app-runtime` |
| 42 | Office Add-ins — Word (GAP → iOS, gizzi-code) | `[x]` | DEFER — one shared web component (AciAddinView.tsx, OfficeHost type) covers all 3 hosts; no iOS/gizzi-code equiv; Add-ins run inside Office hosts | Deferred; scope as 1 shared view if pursued | |
| 43 | Office Add-ins — Excel (GAP → iOS, gizzi-code) | `[x]` | DEFER — duplicate target of #42 (same AciAddinView.tsx component) | Deferred, tracked with #42 | |
| 44 | Office Add-ins — PowerPoint (GAP → iOS, gizzi-code) | `[x]` | DEFER — duplicate target of #42 (same AciAddinView.tsx component) | Deferred, tracked with #42 | |
| 45 | Office & Extensions view (GAP → iOS, gizzi-code) | `[x]` | DEFER — web AppsExtensionsView.tsx (652 lines) hub exists; no iOS/gizzi-code hub; bundles deferred #40-44 | Deferred with dependents | |
| 46 | Operator Browser (GAP → gizzi-code) | `[x]` | DEFER — web OperatorBrowserView.tsx; iOS already has documented parity (BrowserChatView.swift); gizzi-code CLI/GUI mismatch | Deferred — CLI/GUI mismatch | |

## Design/Creative (13)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 47 | Design Mode — Questions tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — AppMode.swift:6-8 documents Design mode deliberately skipped on iOS (opens external window on web instead) | Deferred — documented scope decision | |
| 48 | Design Mode — Mobile tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — same documented iOS Design-mode exclusion (AppMode.swift:6-8) | Deferred, same as #47 | |
| 49 | Design Mode — Docs tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — same documented iOS Design-mode exclusion (AppMode.swift:6-8) | Deferred, same as #47 | |
| 50 | Design Mode — Handoff tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — same documented iOS Design-mode exclusion (AppMode.swift:6-8) | Deferred, same as #47 | |
| 51 | Design Mode — Graph tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — same documented iOS Design-mode exclusion (AppMode.swift:6-8) | Deferred, same as #47 | |
| 52 | Design Mode — Pipeline tab (GAP → iOS, gizzi-code) | `[x]` | DEFER — same exclusion; component (ContentPipelineView.tsx) also duplicated by row #58 | Deferred, same as #47 | |
| 53 | Design Marketplace/Registry (GAP → iOS) | `[x]` | DEFER — DesignRegistryView.tsx is also the `market` tab of DesignModeView; covered by iOS Design-mode exclusion | Deferred, same as #47 | |
| 54 | Design Compare (GAP → iOS, gizzi-code) | `[x]` | STALE — ViewRegistry.tsx:387-391 `design-view-compare` route aliases to DesignRegistryView (same as marketplace); no real compare UI exists anywhere | Closed as stale — nothing to port | |
| 55 | Form Surfaces (GAP → iOS, gizzi-code) | `[x]` | REAL — phase 1 shipped: iOS `FormSurfacesView` registry + dynamic renderer for all web field types, entry from `ComposerPlusSheet` (`feat/ios-form-surfaces`) | Shipped phase 1; submit/persist deferred | `feat/ios-form-surfaces` |
| 56 | Canvas Protocol (PARTIAL → iOS) | `[x]` | REAL — phase 1 shipped: all 40+ `CanvasViewType`s + `CanvasSpec` model + spec CRUD helpers in `CanvasClient`, specs ride in existing canvas metadata (`feat/ios-canvas-protocol`) | Shipped phase 1; runtime instantiation of view types deferred | `feat/ios-canvas-protocol` |
| 57 | Design Team Workspace (GAP → iOS, gizzi-code) | `[x]` | DEFER — DesignTeamWorkspace.tsx is the `team` tab of DesignModeView; covered by iOS Design-mode exclusion | Deferred, same as #47 | |
| 58 | Content Pipeline (GAP → iOS, gizzi-code) | `[x]` | STALE — duplicate of #52; both point at the same ContentPipelineView.tsx / `pipeline` tab | Closed as stale/duplicate of #52 | |
| 59 | Live Artifact Editor (PARTIAL → upgrade) | `[x]` | DEFER — LiveArtifactEditor.tsx exists; gap is localStorage-only persistence on web (an upgrade item, not a platform-port gap) | Deferred — out of platform-parity scope | |

## Terminal/Infra (11)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 60 | Monitor (GAP → iOS) | `[x]` | REAL — phase 1 shipped: iOS `MonitorView` + `MonitorClient` + `MonitorStore` wired to `/api/v1/monitor/*`, entry from Settings Infrastructure (`feat/ios-monitor`) | Shipped phase 1; backend routes don't exist yet | `feat/ios-monitor` |
| 61 | Runtime Operations (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/runtime/RuntimeOperationsView.tsx` hub; zero iOS/gizzi-code matches | Port to iOS | |
| 62 | Budget Dashboard (PARTIAL → iOS) | `[ ]` | REAL — web `views/runtime/BudgetDashboardView.tsx` hits `/api/v1/runtime/budget`; iOS/gizzi-code hits are unrelated (token-budget, compiler comments) | Port to iOS | |
| 63 | Replay Manager (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/runtime/ReplayManagerView.tsx` real; zero iOS/gizzi-code matches | Port to iOS | |
| 64 | Prewarm Manager (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/runtime/PrewarmManagerView.tsx` real; gizzi-code "prewarm" hit is unrelated keyboard-modifier code | Port to iOS | |
| 65 | Nodes (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/nodes/NodesView.tsx` polls `/nodes`; gizzi-code "nodes" hits are all AST/tailnet, not infra fleet | Port to iOS | |
| 66 | Cloud Deploy (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/cloud-deploy/CloudDeployView.tsx` full deployments API client; zero iOS/gizzi-code matches | Port to iOS | |
| 67 | Capsule Manager (GAP → iOS) | `[x]` | STALE — web `views/CapsuleManagerView.tsx` is an explicit stub (`stub-capsule-001`, "replace when @allternit/shell-ui available"), no real feature to port | Re-flag as web-build task, not a port gap | |
| 68 | VPS & Servers panel (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/settings/VPSConnectionsPanel.tsx` real SSH CRUD API; iOS only has runtime-pairing picker (narrower, different concept) | Port SSH CRUD to iOS | |
| 69 | Cloud Instances panel (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/settings/CloudInstancesPanel.tsx` real wizard/provider-token API; iOS only has dev-tunnel instance picker | Port to iOS | |
| 70 | Enterprise BYOC panel (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `components/settings/EnterpriseByocPanel.tsx` real usage/credentials API; gizzi-code "BYOC" hits are an unrelated CCR execution mode | Port to iOS | |

## DAG suite (15)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 71 | DAG Integration Page (PARTIAL → upgrade) | `[ ]` | REAL — `views/DagIntegrationPage.tsx` is a stale 4-tab wrapper predating the newer DAG-suite views (Ontology, Security, etc.), which are routed but not surfaced here | Rebuild as full DAG-suite index | |
| 72 | Ontology Viewer (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/OntologyViewer.tsx` live via railsApi; gizzi-code hit is unrelated code comment | Port to gizzi-code | |
| 73 | Directive Compiler (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/DirectiveCompiler.tsx` real `createDagPlan`/`refineDag`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 74 | GC Agents (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/GCAgents.tsx` real archive/index-maintenance controls; zero matches elsewhere | Port to gizzi-code (low priority) | |
| 75 | Receipts Viewer (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/ReceiptsViewer.tsx` real receipts data; zero matches elsewhere | Port to gizzi-code | |
| 76 | Security Dashboard (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/SecurityDashboard.tsx` (1068 lines) real `/api/v1/security/*`; zero matches elsewhere | Port to gizzi-code | |
| 77 | Purpose Binding (GAP → gizzi-code) | `[ ]` | REAL — web `views/dag/PurposeBinding.tsx` (957 lines) real `/api/v1/purposes*`; zero matches elsewhere | Port to gizzi-code | |
| 78 | Observability Dashboard (PARTIAL → upgrade) | `[ ]` | REAL — web `views/dag/ObservabilityDashboard.tsx` real ledger/gate data but no time-series charts or alerting | Add Recharts time-series panels | |
| 79 | Multimodal Input (GAP → gizzi-code) | `[ ]` | REAL — web `views/MultimodalInput/MultimodalInput.tsx` live WebSocket client; gizzi-code hit is unrelated doc string | Port to gizzi-code (scope TBD) | |
| 80 | Evolution Layer (GAP → gizzi-code) | `[x]` | DEFER — web `views/EvolutionLayerView.tsx` (58 lines) is purely static mock, zero backend calls; nothing real to port yet | Defer until web has real backend | |
| 81 | Context Control Plane (GAP → gizzi-code) | `[x]` | DEFER — web `views/ContextControlPlaneView.tsx` (361 lines) is hardcoded mock arrays, zero API calls; nothing real to port yet | Defer until web has real backend | |
| 82 | Swarm ADE (PARTIAL → iOS) | `[ ]` | REAL — web `views/swarm/SwarmADE.tsx` mature (6 view modes, Recharts, export); iOS `.swarms` is only a chat-prompt theme entry, no swarm UI | Port iOS SwarmADE-lite | |
| 83 | H5I panel — Audit (GAP → gizzi-code) | `[ ]` | REAL — web `H5iAuditPanel.tsx` live via `/api/h5i/vibe,init,status`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 84 | H5I panel — Commit (PARTIAL → upgrade) | `[ ]` | REAL — web `H5iCommitPanel.tsx` real commit API but no file-picker/diff preview before commit | Add file-picker/diff-preview step | |
| 85 | H5I panel — Context (GAP → gizzi-code) | `[ ]` | REAL — web `H5iContextPanel.tsx` polls `/api/h5i/context/trace`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 86 | H5I panel — Diff (PARTIAL → upgrade) | `[ ]` | REAL — web `H5iDiffPanel.tsx` only diffs reasoning traces, not actual code/file diffs despite the name | Rename or add real file-diff mode | |
| 87 | Changeset Review (GAP → iOS) | `[x]` | PR #4 merged to main | Closed as shipped | #4 |

## Marketplace/Plugins (4)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 88 | Marketplace (top-level) (PARTIAL → iOS) | `[ ]` | REAL — web mature (`views/MarketplaceView.tsx` etc.), zero matches on iOS | Confirmed gap, build iOS | |
| 89 | Plugin Registry / Plugin Marketplace (PARTIAL → iOS) | `[ ]` | REAL — web+gizzi-code have plugin systems, zero matches on iOS | Confirmed gap, build iOS | |
| 90 | Team Skills panel (GAP → iOS) | `[ ]` | REAL — web `components/marketplace/TeamSkillsPanel.tsx` exists, zero matches on iOS | Confirmed gap, build iOS | |
| 91 | MiroFish simulation engine (GAP → iOS, gizzi-code) | `[x]` | DEFER — web fully built `lib/mirofish/*`, real gap on iOS/gizzi-code but large scope | Defer to later phase | |

## Products/Discovery (5)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 92 | Products Discovery (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/products/ProductsDiscoveryView.tsx` live, no matches iOS/gizzi-code | Confirmed gap | |
| 93 | A://Labs (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/LabsView.tsx` + `views/labs/main/*`, no matches iOS/gizzi-code | Confirmed gap | |
| 94 | Udemy Catalog (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `views/CatalogView.tsx` (Udemy-specific), no matches iOS/gizzi-code | Confirmed gap, lower priority | |
| 95 | Discovery Feed (GAP → iOS, gizzi-code) | `[x]` | STALE — not standalone; nested sub-tab inside `LabsView.tsx`, not its own route | Fold into #93 A://Labs | |
| 96 | Research tab/panel (PARTIAL → iOS) | `[ ]` | REAL — web `views/research/ResearchTab.tsx` nested in Labs, no match iOS | Build iOS, scope inside Labs | |

## Mail/Knowledge (3)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 97 | Mail Monitor (GAP → iOS) | `[ ]` | REAL — web `views/mail-monitor/ConversationMonitorPanel.tsx` live, no match iOS | Confirmed gap, build iOS | |
| 98 | Documents (office-file I/O) (GAP → iOS) | `[ ]` | REAL — web full docx/xlsx/pptx editor (`views/documents/office-io/*`), no match iOS | Confirmed gap, build iOS | |
| 99 | Knowledge (PARTIAL → iOS) | `[x]` | DEFER — no `knowledge/` dir; closest analog `views/MemoryKernelView.tsx`, needs product scoping | Defer pending scoping | |

## Onboarding/Account (10)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 100 | Settings (umbrella/shell) (PARTIAL → upgrade) | `[x]` | STALE — `views/settings/SettingsView.tsx` (1510 lines) is mature, fully wired | Re-scope or close | |
| 101 | Settings > Account (PARTIAL → gizzi-code) | `[x]` | DEFER — pieces exist both sides, but no true settings sync; needs an ADR | Defer, needs architecture decision | |
| 102 | Settings > Platform (PARTIAL → iOS) | `[ ]` | REAL — web platform group complete, iOS `SettingsView.swift` missing api-keys/shortcuts/dispatch/etc. | Build iOS parity | |
| 103 | Settings > Products (GAP → iOS) | `[ ]` | REAL — web Products group wired, no iOS Settings>Products grouping | Build iOS entry linking existing screens | |
| 104 | Settings > Infrastructure (GAP → iOS, gizzi-code) | `[ ]` | REAL (iOS) / STALE (gizzi-code, already CLI-exposed) — web `InfrastructureSettings.tsx` (1669 lines) | Build iOS only | |
| 105 | Settings > Customize (PARTIAL → upgrade) | `[x]` | STALE — Skills/Response-style/Connectors/Plugins panels all implemented and wired | Close or downgrade to cosmetic-only | |
| 106 | Device Pairing panel (GAP → iOS) | `[x]` | PR #5 merged to main | Closed as shipped | #5 |
| 107 | Organization Access panel (GAP → iOS, gizzi-code) | `[ ]` | REAL — web `components/settings/OrganizationAccessPanel.tsx` exists, no iOS, no gizzi-code UI/command | Build iOS + `gizzi org` command | |
| 108 | Compute Billing panel (GAP → iOS) | `[ ]` | REAL — web `ComputeBillingPanel.tsx` exists and wired, no iOS files found | Build iOS | |
| 109 | Enterprise BYOC panel (GAP → iOS, gizzi-code) | `[ ]` | REAL, but DUPLICATE of row 70 (identical text, same feature) — web `EnterpriseByocPanel.tsx` exists, none on iOS/gizzi-code | Merge with row 70, then build | |
| 110 | Model Management view (PARTIAL → upgrade) | `[ ]` | REAL — web `views/settings/ModelManagementView.tsx` (170 lines) is minimal, genuine upgrade work remains | Scope upgrade; check overlap w/ LocalModelManager | |

## AllternitOS (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 111 | AllternitOS (GAP → gizzi-code) | `[ ]` | REAL — web has full OS (`allternit-os/AllternitOS.tsx` etc.), gizzi-code has no windowing/kernel concept | Confirmed gap, scope minimal equivalent | |

## Playground/QA (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 112 | Playground (PARTIAL → iOS) | `[x]` | DEFER — web has full playground, zero matches iOS, but gizzi-code interactive session is a de facto substitute | Real but low value, defer indefinitely | |

## Empty stubs (1)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 113 | `views/gizzi`, `components/mesh`, `lib/mesh-network` (PARTIAL → upgrade) | `[x]` | STALE (mischaracterized) — paths don't exist; git shows ~4,750 lines deleted 2026-07-02 (commit 1a1d9900a), not an empty stub | Confirm if deletion was intentional before restoring | |

## Desktop-only (2)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 114 | Local runtime discovery (PARTIAL → upgrade) | `[x]` | STALE — gizzi-code already has `cli/commands/runtime.ts` equivalent; consolidation opportunity, not a new build | Evaluate shared protocol, no net-new build | |
| 115 | Local Python execution (PARTIAL → upgrade) | `[x]` | STALE — gizzi-code's general tool execution already covers Python; no dedicated desktop file needed | No build needed | |

## gizzi-code-only (5)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 116 | `github ...` GitHub Actions agent bot (GAP → iOS, gizzi-code) | `[x]` | STALE (gizzi-code) — fully implemented `cli/commands/github.ts` (~1630 lines), registered in `cli/main.ts` | Close gizzi-code half; iOS parity is separate | |
| 117 | Local VM management (GAP → gizzi-code) | `[x]` | STALE — `runtime/vm/` (vfkit-based) + `cli/commands/vm.ts` fully built, used in production | Close as shipped | |
| 118 | Teleport / remote dev environments (GAP → gizzi-code) | `[x]` | STALE (gizzi-code) — extensive `remote/RemoteSessionManager.ts` + Teleport UI/hooks already exist | Close gizzi-code half; web/iOS parity is separate DEFER | |
| 119 | Slack app install (GAP → gizzi-code) | `[x]` | STALE — working `install-slack-app` command registered in two command tables | Close as shipped | |
| 120 | Theme switching (`/theme`) (PARTIAL → upgrade) | `[ ]` | REAL — base feature works (CLI + `/theme` slash cmd) but only 3 built-in themes, no custom/palette editing | Scope custom-theme upgrade | |
