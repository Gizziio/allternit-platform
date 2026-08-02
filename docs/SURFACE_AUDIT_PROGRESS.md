# Surface Audit Progress Tracker

Living checklist for the 121 actionable items (83 GAP + 38 PARTIAL) from `docs/SURFACE_AUDIT_FINAL_REPORT.md` (PR #3, 192-item cross-surface audit). The other 71 items (51 intentionally surface-specific + 13 full parity + 7 unclear) need no build work — unclear items need investigation, not implementation, before they'd ever appear here.

**Status legend:** `[ ]` not started · `[~]` in progress (branch/PR open) · `[x]` shipped (merged to main)

**Execution order:** by surface — iOS first (most gaps, most user-facing per the audit's own priority tiers), then gizzi-code, then web/desktop (fewest gaps). Within a surface, tier-a/b/c priority from the final report still applies where noted.

**Process:** each item is re-investigated against the live codebase before any code is written — the original audit was built from research-agent inventories, not a live build, so its claims get re-verified per item rather than trusted blind. When that turns up a stale/incorrect claim (item #2, Device Pairing, was the first case — audit said "can't approve," codebase already had approve, only Deny was missing), the note here is corrected and the real narrower scope is what actually ships. Substantial builds go through agent-orchestrator in an isolated worktree; small corrective fixes with an exact existing pattern to mirror are done directly. Either way: reviewed here before merge. See `GIZZI.md` for the 4-surface architecture and scoping gate.

---

## Core Chat/Home

- [ ] **Projects** _(`GAP` → gizzi-code)_ — A CLI user has no way to group sessions into a named project the way web/iOS do; `init` is a one-shot scaffold, not a browser.
- [ ] **Artifacts Library** _(`PARTIAL` → upgrade)_ — gizzi-code can produce/publish artifacts consumed elsewhere but can't browse its own artifact history.
- [~] **Automation Tasks (Goals/Routines/Loops/Cron)** _(`GAP` → iOS)_ — Missing from iOS specifically; ironically gizzi-code's engine is the richest implementation of this concept across all three surfaces. Confirmed genuinely greenfield (unlike Device Pairing). **Phase 1 (cron jobs) shipped — PR #9.** Routines/Loops/Goals (`/v1/automations`) remain as later phases — see `docs/AUTOMATION_TASKS_MAP.md`.

## Cowork

**Corrected 2026-08-02 after live-code investigation of `surfaces/ai.allternit.com/src/views/cowork/`** (per explicit instruction: don't trust the audit's Cowork sub-view names without checking what's actually wired into the shipped nav today). Verdict: most of the audit's Cowork sub-view list was never real — `ViewRegistry.tsx` registers a component for each one, but grepping for actual dispatchers shows most have **zero call sites**, meaning the component exists in the file tree but nothing in the live app ever renders it. Real, reachable Cowork nav today (`shell/rail/cowork.config.ts` + `CoworkRoot.tsx`): New Task, Agent Hub, **Automation Tasks** (renamed from "Cron" — confirmed in both the rail label and `AutomationTasksView.tsx`'s own fallback title), a dynamic Tasks list, and per-project tabs (Tasks/Agent Tasks/Sources) once a project is open.

- [ ] **Cowork workspace (CoworkRoot)** _(`PARTIAL` → iOS)_ — Web has the richest GUI, gizzi-code's engine is arguably even more capable via CLI, iOS only exposes a toggle. Still real — unaffected by the correction below.
- [~] **Cowork Automation Tasks** _(was "Cowork Cron view")_ — **Confirmed real, and already satisfied**: this is the same underlying concept as the iOS Automation Tasks tab shipped in PR #9 (cron jobs). Not Cowork-scoped specifically on iOS (it's a top-level tab, not nested inside the Cowork toggle the way it is on web), but the functional gap is closed. No further action unless a Cowork-nested placement is specifically wanted later.
- [~] **Cowork Project view** _(re-scoped after deeper investigation — see below)_
- [x] ~~Cowork Runs view~~ / ~~Cowork Tasks view~~ — **Resolved by the same investigation.** The dead `TasksView.tsx` was never it. Real mechanism: rail-tap opens a task directly into the normal chat workspace with its session preloaded (`ShellRail.tsx:772-777`, `setActiveTask`+`setActiveSession`, `activeProjectId` untouched) — lighter-weight than opening a project. Folded into the Cowork Project view re-scope below rather than tracked separately.

**Cowork Project view / Tasks — deeper finding (2026-08-02):** `CoworkProjectView.tsx`'s three tabs are thinner than they look: "Tasks" and "Agent Tasks" are the *same* `Task` object filtered by one `mode` field (not distinct concepts), and "Sources" is a pure static stub with zero data-fetching — web itself never built it. Worse, the project↔task relationship is **unreliable even on web**: task creation syncs a `workspace_id` field to the server, never `projectId`; `fetchTasks()` actively drops the local `projectId` association on every refetch (`useTaskStore.ts:197,603`, called on every `CoworkRoot` mount) — a real, pre-existing web bug, not something to faithfully replicate on iOS.

Separately: iOS's **existing** `ProjectsClient.swift`/`ProjectDetailView.swift` already talks to the real, stable, server-backed `cowork/projects` + `cowork/projects/:id/files` routes (`cowork_routes.rs`) — the same backend `CoworkProjectView.tsx`'s (unbuilt) Sources tab would need. iOS's file support is arguably *ahead* of web here (web has zero consumer for it). What's genuinely missing is **Tasks/Agent Tasks** themselves — a separate concept, served by a different backend (`allternit-cloud-api`'s `GET/POST/PUT/DELETE /api/v1/tasks`), correctly scoped as *not* project-nested given the linkage bug above.

- [~] **Cowork Tasks (task list, not project-nested)** _(`GAP` → iOS)_ — Real, scoped gap: a standalone task list/create/rename/delete/resume view against `allternit-cloud-api`'s `/api/v1/tasks`, deliberately independent of the buggy project↔task association rather than replicating it. See `docs/COWORK_TASKS_MAP.md`. Closes the useful part of both the old "Cowork Project view" and "Cowork Runs/Tasks view" rows above; the Sources tab and reliable project-scoping are explicitly not being chased since they're stub/broken on web itself.
- [ ] **Cowork Wiki section viewer** _(real, but not a Cowork-specific gap — recategorize)_ — `WikiSectionViewer.tsx` is real and live, but rendered inside the app-wide `ArtifactDetailView`/`ArtifactSidecar` (mounted globally in `ShellApp.tsx`), not inside Cowork's own nav. If iOS parity is wanted, scope it as "Artifact sidecar / Wiki viewer" (an app-wide feature Cowork happens to feed into), not as a Cowork sub-view.
- [ ] **Harness Config panel** _(real, but wrong surface — recategorize)_ — `HarnessConfigPanel.tsx` is real and live, but mounted in `OperatorBrowserView.tsx` and `DesignModeView.tsx` — Operator/Browser and Design mode, not Cowork, despite living in the `views/cowork/` folder. Re-scope any iOS work under those surfaces, not Cowork.
- [x] ~~Cowork Drafts view~~ — **Dropped.** `DraftsView.tsx` has zero dispatchers anywhere in the web source; never wired into Cowork's shipped nav. Not a real gap to fix on iOS.
- [x] ~~Cowork Documents view~~ — **Dropped, and the audit's "Artifacts Library" naming guess was also wrong.** `DocumentsView.tsx` has zero dispatchers from Cowork. Separately, the real `library`/"Artifacts Library" viewType (`LibraryView.tsx`) is an unrelated, app-wide content library, not a Cowork feature and not Documents' successor.
- [x] ~~Cowork Tables view~~ — **Dropped.** `TablesView.tsx`, zero dispatchers.
- [x] ~~Cowork Files view~~ — **Dropped.** `FilesView.tsx`, zero dispatchers.
- [x] ~~Cowork Exports view~~ — **Dropped.** `ExportsView.tsx`, zero dispatchers.
- [x] ~~Cowork Insights panel~~ — **Dropped.** `InsightsView.tsx`, zero dispatchers.
- [x] ~~Cowork Activity panel~~ — **Dropped.** `ActivityView.tsx`, zero dispatchers.
- [x] ~~Cowork Goals panel~~ — **Dropped, superseded.** `GoalsView.tsx` has zero dispatchers; the real, live goals UI is a tab inside Automation Tasks (`goals-list` → `AutomationTasksView initialTab="goal"`), already covered by the Automation Tasks item above.
- [x] ~~Cowork Audit log viewer~~ — **Dropped.** `AuditLogViewer.tsx` is only rendered inside the dead `TasksView.tsx` — unreachable.
- [x] ~~Intelli-Schedule panel~~ — **Dropped.** `IntelliSchedulePanel.tsx` is only rendered inside the dead `TasksView.tsx` — unreachable.

**Net effect**: what looked like ~14 Cowork gaps in the original audit is really 2 confirmed-real gaps (Project view; Runs/Tasks pending one more check) plus 2 miscategorized real features to track under other surfaces (Wiki viewer, Harness Config) plus 1 already satisfied (Automation Tasks). The other 9 were never shipped on web at all — building iOS parity for them would have been fixing gaps that don't exist. Static-analysis caveat from the investigation: this is import/dispatch-site analysis, not a running-app check — a feature-flagged or deep-link-only path could theoretically exist and wasn't found.

## Code

- [ ] **Code workspace (CodeRoot)** _(`PARTIAL` → upgrade)_ — gizzi-code is the originating engine and is full; iOS has a genuine but much thinner mobile version.
- [ ] **Code Explorer** _(`GAP` → iOS)_ — iOS has a live shell but no way to browse files without typing commands — a real, fixable gap.
- [ ] **Code Git panel** _(`GAP` → iOS)_ — iOS gap is real (raw pty git is not a UI); gizzi-code's terminal-native git access is a defensible reason it skips a GUI panel.
- [ ] **Code Skills view** _(`GAP` → iOS)_
- [ ] **Code Project view** _(`PARTIAL` → upgrade)_ — Both other surfaces have a thinner, generic version of "per-project workspace" rather than this scoped view.
- [ ] **Code Canvas (live preview split view)** _(`PARTIAL` → iOS)_ — Loose gizzi-code overlap via artifact publish; iOS has nothing.
- [ ] **Code Preview Pane** _(`GAP` → iOS, gizzi-code)_ — A mobile live-preview of code output (e.g. a local web app) is plausible and would be genuinely useful; not a hard blocker.
- [ ] **Orchestrator Center** _(`PARTIAL` → iOS)_
- [ ] **Orchestration View** _(`PARTIAL` → iOS)_ — Likely the same underlying concept as Orchestrator Center, described twice.
- [ ] **Goal Control Center** _(`GAP` → iOS)_ — Missing from iOS only; strong, literal gizzi-code equivalent.
- [ ] **Kanban(+DAG) Board** _(`GAP` → iOS)_ — Missing from iOS only; direct, strong gizzi-code match.
- [ ] **Debug View** _(`PARTIAL` → iOS)_ — Different purpose (tooling the CLI itself vs. debugging an agent's run) but conceptually adjacent.
- [ ] **Logs View** _(`PARTIAL` → iOS)_
- [ ] **Run Inspector** _(`PARTIAL` → iOS)_
- [ ] **Run Replay** _(`GAP` → iOS, gizzi-code)_ — Likely the same underlying capability as "Replay Manager" under Terminal/Runtime/Infra, described in two places; genuinely absent from both other surfaces.
- [ ] **Tools Registry** _(`PARTIAL` → iOS)_
- [ ] **Skills Registry (SkillsRegistryView, "Memory" nav item)** _(`GAP` → iOS)_ — Missing from iOS only; strong gizzi-code match.
- [ ] **Promotion Dashboard** _(`GAP` → iOS, gizzi-code)_ — Absent from both other surfaces, no fundamental blocker to a CLI-side status view.
- [ ] **Automation Tasks (Code)** _(`GAP` → iOS)_ — Explicitly "shares component with Cowork's" in the source — same underlying feature as the Core Chat/Home Automation Tasks row, mode-scoped here.

## ACI/Browser

- [ ] **ACI Browser surface (BrowserCapsuleEnhanced)** _(`GAP` → gizzi-code)_ — Web and iOS both have real browser-automation implementations; gizzi-code has no equivalent capability despite being a plausible fit (e.g. via a browser-control MCP tool).
- [ ] **Mini-apps Store** _(`GAP` → iOS)_ — Missing from iOS; gizzi-code's plugin marketplace is an adjacent but not equivalent mechanism.
- [ ] **Mini-app frame/runtime** _(`GAP` → iOS)_ — iOS has no sandboxed extension-runtime concept at all.
- [ ] **Office Add-ins — Word** _(`GAP` → iOS, gizzi-code)_ — No fundamental blocker; just not built on either surface.
- [ ] **Office Add-ins — Excel** _(`GAP` → iOS, gizzi-code)_ — Same.
- [ ] **Office Add-ins — PowerPoint** _(`GAP` → iOS, gizzi-code)_ — Same.
- [ ] **Office & Extensions view** _(`GAP` → iOS, gizzi-code)_ — Combined view over the above; same gap.
- [ ] **Operator Browser** _(`GAP` → gizzi-code)_ — gizzi-code lacks any browser-automation capability; web's Operator Browser and iOS's ACI computer-use mode are plausibly the same underlying feature under two names.

## Design/Creative

- [ ] **Design Mode — Questions tab** _(`GAP` → iOS, gizzi-code)_ — A design-brief Q&A flow isn't inherently visual; could plausibly be a chat-like flow on either surface.
- [ ] **Design Mode — Mobile tab (mobile-design preview)** _(`GAP` → iOS, gizzi-code)_ — Previewing mobile-target designs on an actual phone is a plausible, arguably natural fit — not built.
- [ ] **Design Mode — Docs tab** _(`GAP` → iOS, gizzi-code)_ — Documentation generation isn't inherently visual.
- [ ] **Design Mode — Handoff tab (design-to-dev specs)** _(`GAP` → iOS, gizzi-code)_ — Handoff specs are structured text/data, plausibly renderable or exportable on either other surface.
- [ ] **Design Mode — Graph tab (skill graph)** _(`GAP` → iOS, gizzi-code)_ — Node graphs render adequately on mobile too, and gizzi-code could emit a text/tree representation.
- [ ] **Design Mode — Pipeline tab** _(`GAP` → iOS, gizzi-code)_ — A workflow/pipeline view, not canvas-locked.
- [ ] **Design Marketplace/Registry** _(`GAP` → iOS)_ — Missing from iOS; gizzi-code's marketplace covers different content, not a real equivalent.
- [ ] **Design Compare** _(`GAP` → iOS, gizzi-code)_ — Side-by-side variant comparison is a common pattern elsewhere and not inherently desktop-only.
- [ ] **Form Surfaces (schema-driven forms for agent-human comms)** _(`GAP` → iOS, gizzi-code)_ — A structured form-rendering capability for approvals/structured input is absent from both, a real usability gap for e.g. approval flows.
- [ ] **Canvas Protocol (declarative task-surface catalog)** _(`PARTIAL` → iOS)_
- [ ] **Design Team Workspace** _(`GAP` → iOS, gizzi-code)_ — No collaborative design tool equivalent on either other surface.
- [ ] **Content Pipeline** _(`GAP` → iOS, gizzi-code)_
- [ ] **Live Artifact Editor** _(`PARTIAL` → upgrade)_

## Terminal/Infra

- [ ] **Monitor (live agent dashboard, pause/resume/restart)** _(`GAP` → iOS)_ — No live agent-control dashboard on either other surface, though gizzi-code has partial underlying data.
- [ ] **Runtime Operations** _(`GAP` → iOS, gizzi-code)_
- [ ] **Budget Dashboard** _(`PARTIAL` → iOS)_ — Some form exists everywhere; web's dedicated dashboard is richest, iOS's is thinnest.
- [ ] **Replay Manager** _(`GAP` → iOS, gizzi-code)_ — Same underlying gap as Code's "Run Replay," described in two sections.
- [ ] **Prewarm Manager (pre-warmed environment pool)** _(`GAP` → iOS, gizzi-code)_ — Leans internal-ops, but per the audit's own instruction this should still be checked honestly rather than waved through — genuinely absent elsewhere.
- [ ] **Nodes (node/cluster management)** _(`GAP` → iOS, gizzi-code)_
- [ ] **Cloud Deploy (deployment wizard)** _(`GAP` → iOS, gizzi-code)_
- [ ] **Capsule Manager (MCP Interactive Capsules)** _(`GAP` → iOS)_ — Missing from iOS only; gizzi-code's `mcp` command is the probable underlying capability.
- [ ] **VPS & Servers panel** _(`GAP` → iOS, gizzi-code)_
- [ ] **Cloud Instances panel** _(`GAP` → iOS, gizzi-code)_
- [ ] **Enterprise BYOC panel** _(`GAP` → iOS, gizzi-code)_ — Same item recurs under Onboarding & Account below (it's a Settings sub-section too).

## DAG suite

- [ ] **DAG Integration Page (umbrella)** _(`PARTIAL` → upgrade)_
- [ ] **Ontology Viewer** _(`GAP` → gizzi-code)_ — A real finding: no CLI-side way to browse the system's ontology despite this being a natural introspection fit for a technical tool.
- [ ] **Directive Compiler** _(`GAP` → gizzi-code)_ — Real gap: no CLI equivalent for compiling high-level directives into executable plans.
- [ ] **GC Agents (garbage-collection/lifecycle)** _(`GAP` → gizzi-code)_
- [ ] **Receipts Viewer (cryptographic/audit receipts)** _(`GAP` → gizzi-code)_ — Real gap worth flagging: an audit-receipts capability exists only in the web debug UI with nothing generating or viewing receipts CLI-side.
- [ ] **Security Dashboard** _(`GAP` → gizzi-code)_ — Distinct concepts: a skill for the agent to use vs. a dashboard about the CLI's own security posture.
- [ ] **Purpose Binding (governance: bind actions to declared purpose)** _(`GAP` → gizzi-code)_
- [ ] **Observability Dashboard** _(`PARTIAL` → upgrade)_
- [ ] **Multimodal Input (testing UI)** _(`GAP` → gizzi-code)_ — gizzi-code lacks even a dev-facing multimodal test tool.
- [ ] **Evolution Layer (memory/skill/workflow self-improvement)** _(`GAP` → gizzi-code)_ — Real gap: gizzi-code lacks this despite self-improvement being a very CLI-agent-native concept.
- [ ] **Context Control Plane (git-based context controller)** _(`GAP` → gizzi-code)_
- [ ] **Swarm ADE (multi-agent swarm dashboard)** _(`PARTIAL` → iOS)_ — Real gizzi-code capability, likely thinner than web's 34-file dashboard; missing from iOS entirely.
- [ ] **H5I panel — Audit** _(`GAP` → gizzi-code)_
- [ ] **H5I panel — Commit** _(`PARTIAL` → upgrade)_
- [ ] **H5I panel — Context** _(`GAP` → gizzi-code)_
- [ ] **H5I panel — Diff** _(`PARTIAL` → upgrade)_
- [x] **Changeset Review (diff cards, approve/reject)** _(`GAP` → iOS)_ — Genuine, actionable gap: a mobile user can kick off an agentic coding session but apparently can't review changes before they're applied. **Shipped — PR #4.** Backend needed no changes — gizzi-code's `/v1/permission` queue already existed.

## Marketplace/Plugins

- [ ] **Marketplace (top-level)** _(`PARTIAL` → iOS)_
- [ ] **Plugin Registry / Plugin Marketplace (480-file built-in catalog)** _(`PARTIAL` → iOS)_
- [ ] **Team Skills panel (org-level shared skills)** _(`GAP` → iOS)_
- [ ] **MiroFish simulation engine** _(`GAP` → iOS, gizzi-code)_ — A genuinely distinct product feature with no equivalent elsewhere; no fundamental blocker to at least a text-based CLI version.

## Products/Discovery

- [ ] **Products Discovery** _(`GAP` → iOS, gizzi-code)_
- [ ] **A://Labs (experimental features)** _(`GAP` → iOS, gizzi-code)_
- [ ] **Udemy Catalog** _(`GAP` → iOS, gizzi-code)_ — Lower-priority third-party integration, but still a real, uncontested gap per the rubric.
- [ ] **Discovery Feed** _(`GAP` → iOS, gizzi-code)_
- [ ] **Research tab/panel** _(`PARTIAL` → iOS)_

## Mail/Knowledge

- [ ] **Mail Monitor** _(`GAP` → iOS)_ — Missing from iOS; gizzi-code's overlap exists only as an unwired/inactive feature.
- [ ] **Documents (office-file I/O)** _(`GAP` → iOS)_ — Real gap on iOS (can't open/edit an Office doc on mobile); gizzi-code's absence is defensible since it's file-native.
- [ ] **Knowledge (stub — not implemented on web itself)** _(`PARTIAL` → iOS)_ — Notable inversion: web's own "Knowledge" directory is an unimplemented stub, so gizzi-code is arguably ahead here, not behind.

## Onboarding/Account

- [ ] **Settings (umbrella/shell)** _(`PARTIAL` → upgrade)_
- [ ] **Settings > Account (Sign-in, Org & Access, Usage, Plans & Compute, Billing, Privacy)** _(`PARTIAL` → gizzi-code)_ — Sign-in/Account/Usage are solid parity; Org Access and Billing specifically are absent from both other surfaces.
- [ ] **Settings > Platform (General, Appearance, Models, API Keys, Shortcuts, Permissions, Dispatch, Devices, Cloud Instances, Diagnostics)** _(`PARTIAL` → iOS)_ — gizzi-code covers most of this category piecemeal via separate commands; iOS covers comparatively little of it explicitly.
- [ ] **Settings > Products (Gizziio Code settings, Cowork settings, Extensions)** _(`GAP` → iOS)_ — Missing from iOS; gizzi-code's absence for its own self-referential settings is defensible, but iOS's absence isn't.
- [ ] **Settings > Infrastructure (Infrastructure, VPS & Servers, Enterprise BYOC, Environment, Security, Agents)** _(`GAP` → iOS, gizzi-code)_ — Real finding: infra management is thin-to-absent on both other surfaces, even though gizzi-code as "the brain" is a plausible place for CLI-driven infra config.
- [ ] **Settings > Customize (Skills, Response Style, Connectors, Allternit Plugins)** _(`PARTIAL` → upgrade)_ — Response Style is a confirmed direct FULL PARITY sub-item across all three (flagged explicitly in the source map as a good parity check); Skills customization specifically is missing on iOS.
- [x] **Device Pairing panel** _(`GAP` → iOS)_ — **Audit finding was stale**: iOS already had a complete, wired-in approve/lookup/list flow (`RuntimeDevicesClient`/`RuntimePairingView`) mirroring web's panel almost line-for-line. The real gap was narrower — no Deny action. **Shipped — PR #5.**
- [ ] **Organization Access panel** _(`GAP` → iOS, gizzi-code)_ — Arguably reasonable that an agent CLI doesn't manage org membership (identity/admin plane, not agent capability), but nothing structurally prevents it — not built, not clearly out of scope.
- [ ] **Compute Billing panel** _(`GAP` → iOS)_
- [ ] **Enterprise BYOC panel** _(`GAP` → iOS, gizzi-code)_ — Same item as the Terminal/Infra section's BYOC row — it's both a Settings sub-section and a standalone panel in the source inventory.
- [ ] **Model Management view** _(`PARTIAL` → upgrade)_ — gizzi-code match is clear and strong; iOS is genuinely unclear from the inventory description alone.

## AllternitOS

- [ ] **AllternitOS (kernel/windowing/installable "programs")** _(`GAP` → gizzi-code)_ — iOS's absence is structurally defensible; gizzi-code's absence is the more actionable finding since several of AllternitOS's "programs" are conceptually close to things gizzi-code's skill bundles already do piecemeal, just not as an installable-program model.

## Playground/QA

- [ ] **Playground (model-parameter workbench)** _(`PARTIAL` → iOS)_

## Empty stubs

- [ ] **`views/gizzi`, `components/mesh`, `lib/mesh-network` (empty stub dirs)** _(`PARTIAL` → upgrade)_ — Notable inversion of the usual pattern: web/desktop's own "mesh" directory is an empty, unimplemented stub while iOS has a real, functioning Mesh networking feature — iOS is ahead here, not behind.

## Desktop-only

- [ ] **Local runtime discovery (`agent-workspace/discovery.ts`, `runtime-client.ts`)** _(`PARTIAL` → upgrade)_ — The one item in this list with a real, named gizzi-code equivalent — flagged explicitly by the phase task as worth checking before assuming no overlap, and it does overlap.
- [ ] **Local Python execution (`PythonExecutionService.ts`)** _(`PARTIAL` → upgrade)_ — gizzi-code's general coding-agent tool access is a real, arguably better equivalent mechanism; iOS is properly excluded by sandboxing.

## gizzi-code-only

- [ ] **`github ...` (install/run a GitHub Actions agent bot for issue/PR mentions)** _(`GAP` → iOS, gizzi-code)_ — A real, sizable capability (1600+ lines) with no platform-UI equivalent on either other surface, despite being explicitly tagged by the source inventory as "settings-shaped" (comparable to how Connector Settings or MCP management got a GUI).
- [ ] **Local VM management (`vm.ts`, "manage local VMs via vfkit")** _(`GAP` → gizzi-code)_ — iOS's absence is structural (sandboxing), but Desktop's absence is the real finding: Desktop already exposes other local-execution-adjacent panels (Terminal, Cloud Deploy) and would be a plausible home for local sandboxed-VM management, yet has none.
- [ ] **Teleport / remote dev environments (run or resume a session inside a remote/cloud dev environment or VM, with stash/resume)** _(`GAP` → gizzi-code)_ — Distinct from the already-covered "Checkpointing" row (Part 1A), which only captures teleport's stash/resume sub-mechanism — the core "run my session remotely" capability itself has no web/iOS equivalent.
- [ ] **Slack app install (`/install-slack-app`)** _(`GAP` → gizzi-code)_ — Installs the Gizzi/Claude Slack app into a workspace; no platform-UI equivalent, despite being a similarly "settings-shaped" integration to the GitHub bot and MCP connector management that *do* have GUIs elsewhere.
- [ ] **Theme switching (`/theme`)** _(`PARTIAL` → upgrade)_ — Web and gizzi-code both have a real, if differently-shaped, theme-switching capability; iOS doesn't clearly have one from its own inventory.
