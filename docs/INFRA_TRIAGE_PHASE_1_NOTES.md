---
status: done
files_changed: []
deviations: []
remaining: []
---

# Infra Triage — Phase 1 Notes

Re-verification of the 11 Terminal/Infra items (rows 60–70) and 16 DAG suite items (rows 71–86) from `docs/SURFACE_AUDIT_SESSION_PROGRESS.md`, against the live web (`surfaces/ai.allternit.com`), iOS (`surfaces/allternit-mobile/ios`), and gizzi-code (`cmd/gizzi-code/src`) codebases. Read-only investigation; no source files were modified.

**Method:** every web component cited below was confirmed lazy-imported in `surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx` and mapped to a routable key in `surfaces/ai.allternit.com/src/views/registry.ts` (i.e. reachable from navigation, not an orphan file). iOS `Features/` only contains `ACI, Agents, Artifacts, Chat, Code, Connectors, History, Onboarding, Projects, Settings` — no Terminal/Infra/DAG/Swarm/H5I directories exist there yet. gizzi-code is a terminal CLI coding agent; every apparent keyword hit there was individually read and checked for false positives (e.g. token-budget vs. spend-budget, keyboard-modifier "prewarm" vs. VM-pool prewarm, AST/tailnet "nodes" vs. compute-node fleet, CCR "BYOC" execution mode vs. Bring-Your-Own-Cloud credentials).

---

## Terminal/Infra (rows 60–70)

### 60. Monitor — REAL
Web: `views/MonitorView.tsx`, key `monitor` (`ViewRegistry.tsx:99,240-241`), calls real `/api/v1/monitor/agents`, `/monitor/logs`, `/monitor/system`.
iOS: no `Monitor*` view in `Features/`; only unrelated comment-string hits.
gizzi-code: `runtime/tools/builtins/monitortool/MonitorTool.ts` is an explicit `// TEMPORARY SHIM` / `// TODO: implement` no-op, not a dashboard.
Next action: port a Monitor view to iOS backed by the existing `/api/v1/monitor/*` endpoints.

### 61. Runtime Operations — REAL
Web: `views/runtime/RuntimeOperationsView.tsx`, key `runtime-ops` (`ViewRegistry.tsx:87,529-533`) — a hub composing the real `useBudget`/`useReplay`/`usePrewarm` hooks.
iOS/gizzi-code: zero matches for `runtime.?operat` in either tree.
Next action: no standalone port target until Budget/Replay/Prewarm sub-panels exist on iOS individually.

### 62. Budget Dashboard — REAL
Web: `views/runtime/BudgetDashboardView.tsx`, key `budget-dashboard` (`ViewRegistry.tsx:84,536-538`); `hooks/useBudget.ts:199` (`GET /api/v1/runtime/budget`), `:254` (`POST .../quota`).
iOS: only false-positive hits (Swift compiler "expression budget" comments).
gizzi-code: `budget` hits are all LLM token-budget internals, unrelated to infra spend tracking.
Next action: port a spend/quota screen to iOS Settings against `/api/v1/runtime/budget`.

### 63. Replay Manager — REAL
Web: `views/runtime/ReplayManagerView.tsx`, key `replay-manager` (`ViewRegistry.tsx:85,541-543`); `hooks/useReplay.ts:40` (`GET /api/v1/runtime/replay/sessions`), `:56` (execute run).
iOS/gizzi-code: zero matches for `replay.?manager`/`ReplayManager` anywhere.
Next action: genuine gap — port a replay-session list/execute UI to iOS.

### 64. Prewarm Manager — REAL
Web: `views/runtime/PrewarmManagerView.tsx`, key `prewarm-manager` (`ViewRegistry.tsx:86,546-548`); `hooks/usePrewarm.ts:119` (status), `:146` (create pool), `:167` (warmup).
iOS: zero hits for `prewarm`.
gizzi-code: only unrelated hit is a macOS keyboard-modifier native-module "prewarm" (`shared/utils/modifiers.ts`), not VM/sandbox pool warming.
Next action: genuine gap — port pool status/warmup controls to iOS.

### 65. Nodes — REAL
Web: `views/nodes/NodesView.tsx` (+`views/nodes/index.ts`), key `nodes` (`ViewRegistry.tsx:54,320-322`); `views/nodes/hooks/useNodes.ts:20` polls `GET {API_BASE}/nodes`, `:46` node actions.
iOS: 0 hits for `\bnodes\b`.
gizzi-code: 246 `\bnodes\b` hits, all AST/tree-sitter/DOM-renderer/mesh-network (tailnet sidecar) — none are the infra "compute node fleet" concept.
Next action: genuine gap — port a compute-node list/action screen to iOS.

### 66. Cloud Deploy — REAL
Web: `views/cloud-deploy/CloudDeployView.tsx`, key `deploy` (`ViewRegistry.tsx:52,315-317`); `views/cloud-deploy/lib/api-client.ts` — full client: `/api/v1/deployments`, `/deployments/:id/cancel`, WS `/deployments/:id/events`, `/providers/:id/validate`, `/instances`, `/wizard/*`.
iOS/gizzi-code: zero matches for `cloud.?deploy`/`CloudDeploy`.
Next action: genuine gap — port a deployment-wizard/status screen to iOS.

### 67. Capsule Manager — STALE
Web: `views/CapsuleManagerView.tsx`, key `capsules` (`ViewRegistry.tsx:55,325-327`) — but the component is an explicit stub: `// Stub components — replace when @allternit/shell-ui package is available` (L15), renders hardcoded `dummyCapsule` id `'stub-capsule-001'` (L32), zero API calls.
iOS: no Capsule Manager; iOS `Capsule` hits are all SwiftUI's built-in `Capsule()` shape primitive (unrelated).
Next action: no port work makes sense yet — the web "reference" itself is dead/placeholder code, so the original audit's premise (a working feature to port) is wrong. Re-flag as a web-implementation task before any iOS/gizzi-code gap is meaningful.

### 68. VPS & Servers panel — REAL
Web: `views/settings/VPSConnectionsPanel.tsx`, reachable via `settings.config.ts:71` (`id:'vps'`) → `SettingsView.tsx:1403`; uses `sshApi` (`api/infrastructure/ssh.ts:136`, real CRUD/connect/install-agent against `/api/v1/ssh-connections`) and `runtimeBackendApi` (`/api/v1/runtime/backend`).
iOS: `Core/API/InstancesClient.swift` + `Features/Code/CodeModeView.swift` only implement a runtime-pairing picker (`/api/v1/runtime-devices`, `/api/v1/runtime-pairings/code/:code[/approve]`) — "pick which paired runtime to relay through," not SSH connection CRUD.
gizzi-code: `VPS` hits are only comments about BYO-VPS bootstrap config mounting, no connection-management surface.
Next action: genuine gap, distinct from the existing pairing picker — port SSH connection add/test/connect to iOS.

### 69. Cloud Instances panel — REAL
Web: `views/settings/CloudInstancesPanel.tsx`, reachable via `settings.config.ts:65` (`id:'cloud-instances'`) → `SettingsView.tsx:1405`; real calls to `/api/v1/cloud/wizard/deployments`, `/api/v1/provider-tokens`, `/api/v1/providers/:id/validate`.
iOS: no Cloud Instances panel; `InstancesClient.swift` only fetches self-registered `gizzi serve --tunnel` dev instances (`/api/v1/gizzi-instances`) — a narrower, different concept.
gizzi-code: no cloud-provider wizard/token equivalent found.
Next action: genuine gap — port a cloud-provider instances/wizard screen to iOS; don't conflate with the existing gizzi-instances tunnel picker.

### 70. Enterprise BYOC panel — REAL
Web: `components/settings/EnterpriseByocPanel.tsx`, reachable via `settings.config.ts:72` (`id:'cloud-credentials'`) → `SettingsView.tsx:1406`; real data via `lib/enterprise-usage.ts:30` (`GET /api/v1/usage/summary`), embeds `CloudCredentialsPanel`/`OrganizationAccessPanel`.
iOS: zero surfacing of org-scoped usage/credential management.
gizzi-code: `BYOC` hits there mean something unrelated — "Claude Code Router / BYOC" execution/file-upload mode (`gizzi-core/setup.ts:419`), a false-positive keyword collision, not an org credentials feature.
Next action: genuine gap — port an org-scoped usage/credentials screen to iOS.

---

## DAG suite (rows 71–86)

### 71. DAG Integration Page — REAL
Web: `views/DagIntegrationPage.tsx` (key `dag`, `ViewRegistry.tsx:309-313`) is a 96-line, 4-tab wrapper around SwarmDashboard/IVKGEPanel/MultimodalInput/UIForge only. It predates the newer P5 DAG-suite views (Ontology, Directive Compiler, GC Agents, Receipts, Security, Purpose Binding, etc.), which are each independently routed but never surfaced inside this aggregator.
Next action: rebuild as a real index/nav over all 15+ DAG-suite views, or remove it if sidebar nav already links each view key directly.

### 72. Ontology Viewer — REAL
Web: `views/dag/OntologyViewer.tsx` → `OntologyViewerSurface` in `views/dag/DagRuntimeWorkspace.tsx:930-1013` — live Mermaid diagram + entity table from `useDakStore()`/`railsApi`. Key `ontology` (`ViewRegistry.tsx:460-464`).
gizzi-code: only false-positive hit is an unrelated code comment (`memdir/memoryTypes.ts:238`).
iOS: zero hits.
Next action: genuine gap — scope a gizzi-code `ontology` subcommand against the same railsApi DAG endpoints.

### 73. Directive Compiler — REAL
Web: `views/dag/DirectiveCompiler.tsx` → `DirectiveCompilerSurface` (`DagRuntimeWorkspace.tsx:592-660`) — real `createDagPlan`/`refineDag` via `railsApi.plan.render`. Key `directive` (`ViewRegistry.tsx:515-519`).
gizzi-code/iOS: no hits.
Next action: genuine gap — port as CLI equivalent of DAG plan create/refine.

### 74. GC Agents — REAL
Web: `views/dag/GCAgents.tsx` → `GCAgentsSurface` (`DagRuntimeWorkspace.tsx:758+`) — live archive/index-maintenance controls (`runtime.archiveWih`, `rebuildIndex`, `rerunGateVerify`). Key `gc-agents` (`ViewRegistry.tsx:525-529`).
gizzi-code/iOS: no hits.
Next action: genuine gap, low priority (maintenance tooling) — CLI equivalent could call the same railsApi archive endpoints.

### 75. Receipts Viewer — REAL
Web: `views/dag/ReceiptsViewer.tsx` → `ReceiptsViewerSurface` (`DagRuntimeWorkspace.tsx:1021+`) — live receipts data. Key `receipts` (`ViewRegistry.tsx:480-484`).
gizzi-code/iOS: no hits.
Next action: genuine gap — straightforward CLI/mobile port against the existing receipts API.

### 76. Security Dashboard — REAL
Web: `views/dag/SecurityDashboard.tsx` (1068 lines), backed by `lib/governance/policy.service.ts` (`/api/v1/security/overview`, `/security/events`, etc.). Key `security` (`ViewRegistry.tsx:490-494`).
gizzi-code/iOS: no hits.
Next action: genuine gap — meatiest surface (compliance/alerts/events); good candidate for a gizzi-code command reading the same endpoints.

### 77. Purpose Binding — REAL
Web: `views/dag/PurposeBinding.tsx` (957 lines), backed by `policy.service.ts` (`/api/v1/purposes*`). Key `purpose` (`ViewRegistry.tsx:495-499`).
gizzi-code/iOS: no hits.
Next action: genuine gap — port as a CLI purpose-binding manager against the same policy service.

### 78. Observability Dashboard — REAL
Web: `views/dag/ObservabilityDashboard.tsx` → `ObservabilityDashboardSurface` (`DagRuntimeWorkspace.tsx:1152-1264`) — real ledger tail/trace, gate verification, receipt-evidence stats. Key `observability` (`ViewRegistry.tsx:510-514`).
What's partial: no time-series charts at all (unlike `MonitorView.tsx` or the swarm suite's Recharts history view) — just text/badge cards and a raw JSON ledger list; no alerting/SLO tracking.
Next action: add Recharts-based time-series panels (ledger event rate, gate-failure trend), reusing the swarm-suite's metrics-history pattern.

### 79. Multimodal Input — REAL
Web: `views/MultimodalInput/MultimodalInput.tsx` — live WebSocket client (`ws://.../api/v1/multimodal/ws`). Key `multimodal` (`ViewRegistry.tsx:470-474`).
gizzi-code: only false-positive hit is a doc string ("Gizzi is a multimodal LLM") in a file-read tool prompt.
iOS: zero hits.
Next action: genuine gap, but scope depends on whether a terminal CLI agent needs live multimodal streaming at all — may be low priority.

### 80. Evolution Layer — DEFER
Web: `views/EvolutionLayerView.tsx` (58 lines) is purely static — 4 hardcoded description cards (Memory/Skill/Confidence/Trajectory evolution), zero fetch/state/interactivity. Key `evolution` (`ViewRegistry.tsx:425-429`).
gizzi-code/iOS: no hits.
Next action: the web reference itself has no data model or API to port; building gizzi-code support now is premature. Defer until the web surface is backend-connected.

### 81. Context Control Plane — DEFER
Web: `views/ContextControlPlaneView.tsx` (361 lines) is entirely hardcoded mock arrays (`BRANCHES`, `COMMITS`), zero fetch/API calls — a UI mockup of a "Git Context Controller," not backend-connected. Key `context-control` (`ViewRegistry.tsx:430-434`).
gizzi-code/iOS: no hits.
Next action: same as Evolution Layer — flag as design-mockup-only; defer porting until web has a real backend.

### 82. Swarm ADE — REAL
Web: `views/swarm/SwarmADE.tsx`, key `swarm` (`ViewRegistry.tsx:445-449`). `views/swarm/README.md` documents a mature feature set (6 view modes, Recharts metrics, batch ops, templates, CSV/JSON export, virtualized grid for 100+ agents); `IMPLEMENTATION_SUMMARY.md` shows only one remaining internal placeholder.
iOS: `Core/DesignSystem/ModeTheme.swift` has a `.swarms` case, but it's only a chat-prompt-template/theme entry ("Coordinate a swarm of agents to tackle this:") — no agent grid, topology graph, or orchestration dashboard exists.
Next action: matches the PARTIAL label exactly — scope an iOS SwarmADE-lite (Grid + Detail views minimum) against the existing `/api/v1/swarm/*` endpoints.

### 83. H5I panel — Audit — REAL
Web: `components/h5i/H5iAuditPanel.tsx`, wired in `views/code/CodeCanvasView.tsx:657-663`. Calls `fetchH5iVibe`/`initH5i`/`fetchH5iStatus` (`lib/h5i/client.ts:28-65`) against `/api/h5i/vibe`, `/api/h5i/init`, `/api/h5i/status`, dev-proxied to a real backend gateway (`vite.config.ts:154-157`).
gizzi-code/iOS: zero `h5i` hits in either tree.
Next action: genuine gap — h5i is a git-provenance/audit tool, a natural CLI fit; likely easier to port to gizzi-code than to iOS.

### 84. H5I panel — Commit — REAL
Web: `components/h5i/H5iCommitPanel.tsx`, wired in `CodeCanvasView.tsx:666-673`, calls real `commitWithH5i()` (`lib/h5i/client.ts:197-212`, `POST /api/h5i/commit`).
What's partial: form only has message/model/agent/prompt fields — no staged-file list or diff preview; the client already supports a `files?: string[]` option (line 200) but the UI never exposes it, so commits are blind relative to working-tree state.
Next action: add a file-picker/diff-preview step (reuse H5iDiffPanel's rendering) before the commit action fires.

### 85. H5I panel — Context — REAL
Web: `components/h5i/H5iContextPanel.tsx`, wired from `components/canvas/CodeCanvasTileSession.tsx:210`, polls `fetchH5iContextTrace()` every 5s against `/api/h5i/context/trace`.
gizzi-code/iOS: no hits.
Next action: genuine gap — straightforward CLI read-only trace viewer against the same endpoint.

### 86. H5I panel — Diff — REAL
Web: `components/h5i/H5iDiffPanel.tsx`, wired in `CodeCanvasView.tsx:676-683`, calls real `diffH5iContext()` (`lib/h5i/client.ts:180-195`, `POST /api/h5i/context/diff`).
What's partial: despite the "Diff Panel" label, it only compares two sessions' OBSERVE/THINK/ACT reasoning-trace entries — there is no file/code diff rendering (no line-level diff, no syntax highlighting, no unified/split view). A user expecting a code diff gets a reasoning-log comparison instead.
Next action: either rename to avoid implying code diffing, or add a genuine file-diff mode alongside the reasoning-trace diff.

---

## Summary

| Classification | Count | Items |
|---|---|---|
| REAL | 24 | 60–66, 68–79 (minus 80–81), 82–86 |
| STALE | 1 | 67 (Capsule Manager) |
| DEFER | 2 | 80 (Evolution Layer), 81 (Context Control Plane) |

Key findings:
- Every gizzi-code "gap" that looked like it might already have coverage turned out to be a false-positive keyword collision (token-budget vs. spend-budget, keyboard-modifier prewarm vs. VM-pool prewarm, AST/tailnet "nodes" vs. compute-node fleet, CCR "BYOC" execution mode vs. Bring-Your-Own-Cloud credentials). None of the 27 items have real gizzi-code coverage today.
- iOS's only infra-adjacent surface anywhere is the runtime-device pairing picker (`InstancesClient.swift`, `CodeModeView.swift`) — confirmed narrower than every REAL item (it's "pick which backend to relay through," not monitoring/budget/replay/prewarm/nodes/deploy/VPS-CRUD/cloud-instances/BYOC-usage/DAG-suite/H5I).
- Two items (Capsule Manager, and the DEFER pair Evolution Layer / Context Control Plane) have non-functional web "reference" implementations (explicit stub or hardcoded mock data, zero backend calls) — porting them to iOS/gizzi-code now would mean porting nothing real. Capsule Manager is marked STALE because the audit's premise (a working feature to port) is simply wrong; Evolution Layer and Context Control Plane are marked DEFER because the underlying concept is legitimate but needs a web backend built first.
