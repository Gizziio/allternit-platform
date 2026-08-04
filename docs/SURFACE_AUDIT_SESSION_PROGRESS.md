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
| 20 | Code workspace (CodeRoot) (PARTIAL → upgrade) | `[ ]` | | | |
| 21 | Code Explorer (GAP → iOS) | `[ ]` | | | |
| 22 | Code Git panel (GAP → iOS) | `[ ]` | | | |
| 23 | Code Skills view (GAP → iOS) | `[ ]` | | | |
| 24 | Code Project view (PARTIAL → upgrade) | `[ ]` | | | |
| 25 | Code Canvas (live preview split view) (PARTIAL → iOS) | `[ ]` | | | |
| 26 | Code Preview Pane (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 27 | Orchestrator Center (PARTIAL → iOS) | `[ ]` | | | |
| 28 | Orchestration View (PARTIAL → iOS) | `[ ]` | | | |
| 29 | Goal Control Center (GAP → iOS) | `[ ]` | | | |
| 30 | Kanban(+DAG) Board (GAP → iOS) | `[ ]` | | | |
| 31 | Debug View (PARTIAL → iOS) | `[ ]` | | | |
| 32 | Logs View (PARTIAL → iOS) | `[ ]` | | | |
| 33 | Run Inspector (PARTIAL → iOS) | `[ ]` | | | |
| 34 | Run Replay (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 35 | Tools Registry (PARTIAL → iOS) | `[ ]` | | | |
| 36 | Skills Registry (GAP → iOS) | `[ ]` | | | |
| 37 | Promotion Dashboard (GAP → iOS, gizzi-code) | `[ ]` | | | |
| 38 | Automation Tasks (Code) (GAP → iOS) | `[ ]` | | | |

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
| 60 | Monitor (GAP → iOS) | `[x]` | REAL — web `views/MonitorView.tsx` hits real `/api/v1/monitor/*`; iOS has none; gizzi-code `MonitorTool.ts` is a TODO shim | Port to iOS | |
| 61 | Runtime Operations (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/runtime/RuntimeOperationsView.tsx` hub; zero iOS/gizzi-code matches | Port to iOS | |
| 62 | Budget Dashboard (PARTIAL → iOS) | `[x]` | REAL — web `views/runtime/BudgetDashboardView.tsx` hits `/api/v1/runtime/budget`; iOS/gizzi-code hits are unrelated (token-budget, compiler comments) | Port to iOS | |
| 63 | Replay Manager (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/runtime/ReplayManagerView.tsx` real; zero iOS/gizzi-code matches | Port to iOS | |
| 64 | Prewarm Manager (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/runtime/PrewarmManagerView.tsx` real; gizzi-code "prewarm" hit is unrelated keyboard-modifier code | Port to iOS | |
| 65 | Nodes (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/nodes/NodesView.tsx` polls `/nodes`; gizzi-code "nodes" hits are all AST/tailnet, not infra fleet | Port to iOS | |
| 66 | Cloud Deploy (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/cloud-deploy/CloudDeployView.tsx` full deployments API client; zero iOS/gizzi-code matches | Port to iOS | |
| 67 | Capsule Manager (GAP → iOS) | `[x]` | STALE — web `views/CapsuleManagerView.tsx` is an explicit stub (`stub-capsule-001`, "replace when @allternit/shell-ui available"), no real feature to port | Re-flag as web-build task, not a port gap | |
| 68 | VPS & Servers panel (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/settings/VPSConnectionsPanel.tsx` real SSH CRUD API; iOS only has runtime-pairing picker (narrower, different concept) | Port SSH CRUD to iOS | |
| 69 | Cloud Instances panel (GAP → iOS, gizzi-code) | `[x]` | REAL — web `views/settings/CloudInstancesPanel.tsx` real wizard/provider-token API; iOS only has dev-tunnel instance picker | Port to iOS | |
| 70 | Enterprise BYOC panel (GAP → iOS, gizzi-code) | `[x]` | REAL — web `components/settings/EnterpriseByocPanel.tsx` real usage/credentials API; gizzi-code "BYOC" hits are an unrelated CCR execution mode | Port to iOS | |

## DAG suite (15)

| # | Item | Status | Finding | Action | PR |
|---|------|--------|---------|--------|-----|
| 71 | DAG Integration Page (PARTIAL → upgrade) | `[x]` | REAL — `views/DagIntegrationPage.tsx` is a stale 4-tab wrapper predating the newer DAG-suite views (Ontology, Security, etc.), which are routed but not surfaced here | Rebuild as full DAG-suite index | |
| 72 | Ontology Viewer (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/OntologyViewer.tsx` live via railsApi; gizzi-code hit is unrelated code comment | Port to gizzi-code | |
| 73 | Directive Compiler (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/DirectiveCompiler.tsx` real `createDagPlan`/`refineDag`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 74 | GC Agents (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/GCAgents.tsx` real archive/index-maintenance controls; zero matches elsewhere | Port to gizzi-code (low priority) | |
| 75 | Receipts Viewer (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/ReceiptsViewer.tsx` real receipts data; zero matches elsewhere | Port to gizzi-code | |
| 76 | Security Dashboard (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/SecurityDashboard.tsx` (1068 lines) real `/api/v1/security/*`; zero matches elsewhere | Port to gizzi-code | |
| 77 | Purpose Binding (GAP → gizzi-code) | `[x]` | REAL — web `views/dag/PurposeBinding.tsx` (957 lines) real `/api/v1/purposes*`; zero matches elsewhere | Port to gizzi-code | |
| 78 | Observability Dashboard (PARTIAL → upgrade) | `[x]` | REAL — web `views/dag/ObservabilityDashboard.tsx` real ledger/gate data but no time-series charts or alerting | Add Recharts time-series panels | |
| 79 | Multimodal Input (GAP → gizzi-code) | `[x]` | REAL — web `views/MultimodalInput/MultimodalInput.tsx` live WebSocket client; gizzi-code hit is unrelated doc string | Port to gizzi-code (scope TBD) | |
| 80 | Evolution Layer (GAP → gizzi-code) | `[x]` | DEFER — web `views/EvolutionLayerView.tsx` (58 lines) is purely static mock, zero backend calls; nothing real to port yet | Defer until web has real backend | |
| 81 | Context Control Plane (GAP → gizzi-code) | `[x]` | DEFER — web `views/ContextControlPlaneView.tsx` (361 lines) is hardcoded mock arrays, zero API calls; nothing real to port yet | Defer until web has real backend | |
| 82 | Swarm ADE (PARTIAL → iOS) | `[x]` | REAL — web `views/swarm/SwarmADE.tsx` mature (6 view modes, Recharts, export); iOS `.swarms` is only a chat-prompt theme entry, no swarm UI | Port iOS SwarmADE-lite | |
| 83 | H5I panel — Audit (GAP → gizzi-code) | `[x]` | REAL — web `H5iAuditPanel.tsx` live via `/api/h5i/vibe,init,status`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 84 | H5I panel — Commit (PARTIAL → upgrade) | `[x]` | REAL — web `H5iCommitPanel.tsx` real commit API but no file-picker/diff preview before commit | Add file-picker/diff-preview step | |
| 85 | H5I panel — Context (GAP → gizzi-code) | `[x]` | REAL — web `H5iContextPanel.tsx` polls `/api/h5i/context/trace`; zero gizzi-code/iOS matches | Port to gizzi-code | |
| 86 | H5I panel — Diff (PARTIAL → upgrade) | `[x]` | REAL — web `H5iDiffPanel.tsx` only diffs reasoning traces, not actual code/file diffs despite the name | Rename or add real file-diff mode | |
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
