---
status: done
files_changed: []
deviations: []
remaining: []
---

# Cowork Section Triage — Phase 1 Notes

Read-only re-investigation of the 16 Cowork rows (session tracker rows 4–19) against the live codebase on branch `ao/cowork-triage`. No source files were created, deleted, or modified.

## Method note (important context that shapes every verdict below)

The original audit's Cowork findings compared "does web have it" against iOS/gizzi-code by checking whether a component *file* exists under `surfaces/ai.allternit.com/src/views/cowork/`. That's not the same as the component being *live and reachable* in the shipped app. For every item below I checked three things on web specifically:

1. Does the file exist? (all of them do — 47 files in `views/cowork/`)
2. Is it registered in `surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx`? (most are)
3. Is there an actual call site anywhere in the app that opens that view — `onOpen?.('<viewType>')`, `open('<viewType>')`, or `window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: '<x>' } }))` (the latter is a real, listened-to global open mechanism — confirmed via `shell/ShellApp.tsx:474` `addEventListener('allternit:open-view', ...)`)?

Several Cowork sub-views fail step 3: the component is registered in `ViewRegistry.tsx` but literally nothing in the app ever navigates to it. That means the audit's premise — "web has this, iOS/gizzi-code don't" — is false for those items: web doesn't actually ship them either. This finding was independently reproduced here; a prior, unmerged branch (`docs/cowork-correction`, commit `1f26d3fc4`, not an ancestor of this branch) reached the same conclusion for the same set of views, which is a second, independent line of evidence rather than something I relied on directly.

**Branch-state caveat**: `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` row 3 (Core Chat/Home Automation Tasks) and commit history claim iOS cron/Automation-Tasks work shipped via PR #9 (`22ca46e46`, merged at `f735d135b`). On this checkout (`ao/cowork-triage`, based on `main` at `8be59b917`), that merge is **not an ancestor of HEAD** and none of its files (`Features/Automation/*`, `Core/API/CronClient.swift`, `Core/CronJobStore.swift`) exist in the working tree — confirmed via `find` and `git ls-tree HEAD`. This affects the Cron and Goals items below: on the actual code checked out here, iOS has no Automation Tasks surface at all, regardless of what other branches/docs claim.

---

## 1. Cowork workspace (CoworkRoot) — PARTIAL → iOS

**Classification: REAL**

Evidence: `surfaces/ai.allternit.com/src/views/cowork/CoworkRoot.tsx` is a large, live, fully-wired workspace (chat transcript + inline work blocks + `CoworkRightRail` + project view mounting). On iOS, `Core/AppMode.swift` and `Features/Chat/Views/ChatView.swift` (lines ~940–1800) explicitly document and implement Cowork as a **composer-level toggle inside the Chats tab** (`ChatCoworkToggle`, `CoworkTopDeck`) — not a dedicated workspace with a right rail, run timeline, or project sub-navigation. gizzi-code has an even deeper engine (`cmd/gizzi-code/src/runtime/cowork/cowork.service.ts` — Runs/Schedules/Approvals/Checkpoints tables) via CLI, so the asymmetry is real on iOS specifically.

Recommended next action: `build` (iOS: expand the existing composer-toggle into a real Cowork workspace surface, matching what `Features/Projects` already did for chat-project parity) — but scope carefully, this is the single largest item in the set.

## 2. Cowork Runs view — PARTIAL → iOS

**Classification: STALE** (audit's comparison target is wrong) with a **REAL** residual need noted separately

Evidence: `views/cowork/RunsView.tsx` is registered at `ViewRegistry.tsx:590-594` (`'cowork-runs'`) but has **zero call sites** dispatching to it from anywhere in Cowork's own UI. The only live dispatcher found is `views/products/ProductsDiscoveryView.tsx:826`, where it's mislabeled as a generic "Workflows" product card (beta) inside Products Discovery — completely disconnected from Cowork's nav. So web does not actually ship a "browse past Cowork runs" experience either; the closest live mechanism is the Recents panel mixing cowork tasks into chat history (`shell/ShellRail.tsx:768-777`, opens the task back into the workspace, not a runs table). gizzi-code has the underlying `RunTable`/`RunEventTable` data (`cowork.sql.ts`) with no CLI browser either.

Recommended next action: `close` the item as originally framed (iOS isn't behind web here — nobody has this). If a real "browse past runs with status/duration" feature is wanted, `defer to a new phase` as a fresh cross-surface item, not an iOS-parity fix.

## 3. Cowork Drafts view — GAP → iOS

**Classification: STALE**

Evidence: `views/cowork/DraftsView.tsx` is registered at `ViewRegistry.tsx:595-599` (`'cowork-drafts'`) with **zero dispatchers anywhere** in the source tree (`grep` for `'cowork-drafts'` outside policy/type files returns nothing). Dead code — never shipped to a real nav entry. No surface has a "Drafts" concept; the closest functional analog remains the approval/HITL queue (`ApprovalTable` in gizzi-code's `cowork.sql.ts`, `/cowork/approvals` route in `cmd/allternit-api/src/cowork_routes.rs:69`).

Recommended next action: `close`.

## 4. Cowork Cron view — GAP → iOS

**Classification: STALE** (renamed/merged, not missing)

Evidence: Cron was renamed and merged into **Automation Tasks**. `shell/rail/cowork.config.ts` and the live shared Home rail in `shell/ShellRail.tsx:822-827` both expose an "Automation Tasks" nav entry (`isActive` checks `'goals-list' || 'cron' || 'cowork-cron'`), which opens `AutomationTasksView` (`ViewRegistry.tsx:605-609`, route `'cowork-cron'`, and also `'goals-list'` at line 726-730 with `initialTab="goal"`). This nav item is visible in Cowork mode (it lives in the shared, non-code-mode Home rail block). So on web, Cron is real, live, and reachable from Cowork.

However — per the branch-state caveat above — **iOS does not currently have any Automation Tasks / cron surface in this checkout**, despite tracker claims that PR #9 shipped it. `find`/`git ls-tree HEAD` confirm no `Features/Automation/*`, `CronClient.swift`, or `CronJobStore.swift` exist on this branch.

Recommended next action: `close` the "Cron view" framing as stale (it's Automation Tasks now, same component gizzi-code's cron subsystem already backs), but flag the iOS Automation Tasks gap itself for reconciliation — either the tracker's "shipped" claim needs correcting, or this branch needs to pick up PR #9's commits. Not a new build item under the Cowork name.

## 5. Cowork Project view — GAP → gizzi-code

**Classification: REAL**

Evidence: `views/cowork/CoworkProjectView.tsx` is genuinely live — mounted directly by `CoworkRoot.tsx` (`CoworkRoot.tsx:339-345`, "If there's an active project, show CoworkProjectView instead") with its own Tasks/Agent Tasks tabs (`CoworkProjectView.tsx:59-302`). Backend support is real: `cmd/allternit-api/src/cowork_routes.rs:46` exposes `/cowork/projects`. gizzi-code's `init` scaffolds a project directory (`.gizzi` files) but has no equivalent view of Cowork-run history scoped to a project — it's file-native, not run-history-native. This is a confirmed, live, real gap on gizzi-code specifically (iOS has a general `Features/Projects` tab but that's chat-project parity, not Cowork-run-scoped).

Recommended next action: `build` (gizzi-code: add a `cowork project` CLI view/command surfacing run history for the current project) — or `defer to <phase>` if gizzi-code CLI scope is being handled separately from this iOS-focused tracker.

## 6. Cowork Documents view — GAP → iOS

**Classification: STALE** (real but effectively unreachable, not what the audit described)

Evidence: `views/cowork/DocumentsView.tsx` is registered at `ViewRegistry.tsx:615-619` (`'cowork-documents'`). It has exactly one dispatcher in the whole codebase: `views/code/SkillsRegistryView.tsx:237`, gated behind `skill.origin === 'document-workflow'` inside **Code mode's** Skills Registry — nothing to do with Cowork's own nav. So it is technically live (not 100% dead code, unlike Drafts/Tables/Files) but mis-surfaced and effectively undiscoverable from Cowork. The original audit's guess that this became "Artifacts Library" is also wrong — `library`/`LibraryView.tsx` is a separate, unrelated app-wide content library.

Recommended next action: `close` as a Cowork-specific gap (the audit's framing doesn't match reality); if document viewing inside Cowork is wanted, `defer to <phase>` as a fresh, correctly-scoped item.

## 7. Cowork Tables view — GAP → iOS

**Classification: STALE**

Evidence: `views/cowork/TablesView.tsx` registered at `ViewRegistry.tsx:620-624` (`'cowork-tables'`), zero dispatchers anywhere in the tree. Dead code, never shipped. gizzi-code's absence is defensible (file-native, no in-app table viewer needed for a CLI).

Recommended next action: `close`.

## 8. Cowork Files view — GAP → iOS

**Classification: STALE**

Evidence: `views/cowork/FilesView.tsx` registered at `ViewRegistry.tsx:625-629` (`'cowork-files'`), zero dispatchers anywhere. Dead code. Same pattern as Tables/Documents.

Recommended next action: `close`.

## 9. Cowork Exports view — PARTIAL → iOS

**Classification: STALE**

Evidence: `views/cowork/ExportsView.tsx` registered at `ViewRegistry.tsx:630-634` (`'cowork-exports'`), zero dispatchers anywhere. Dead code on web despite the audit's claim that "web has the richest GUI" here. gizzi-code does have generic `export`/`import` session commands (adjacent, not Cowork-run-specific), so the underlying capability gap for iOS may still be real, but not because iOS is behind a shipped web feature.

Recommended next action: `close` as originally framed; `defer to <phase>` if export/import parity is independently wanted.

## 10. Cowork Insights panel — GAP → iOS, gizzi-code

**Classification: STALE**

Evidence: `views/cowork/InsightsView.tsx` registered at `ViewRegistry.tsx:577` (route `'insights'`), zero dispatchers anywhere in the tree (`grep` for `viewType: 'insights'` / `open('insights')` returns nothing outside the registry/policy/type files). Dead code on web. No backend analytics/insights endpoint found in `cowork_routes.rs` or `cowork_models.rs`. Audit's "GAP on all surfaces" is directionally right (nobody has it) but the premise that web has a shipped panel to compare against is wrong.

Recommended next action: `close` current framing; `defer to <phase>` as a genuinely new cross-surface feature if wanted.

## 11. Cowork Activity panel — GAP → iOS, gizzi-code

**Classification: STALE**

Evidence: `views/cowork/ActivityView.tsx` registered at `ViewRegistry.tsx:580-583` (route `'activity'`), zero dispatchers anywhere. Dead code, same pattern as Insights. Note: this is a different, unrelated component from the recently-shipped "Agent Activity" (Rails Mail) feature (`feat/agent-activity-*` branches, PRs #17/#18/#20) — no naming collision risk but worth flagging since "Activity" is now an overloaded term in this codebase.

Recommended next action: `close`.

## 12. Cowork Goals panel — PARTIAL → iOS

**Classification: STALE** (superseded by Automation Tasks)

Evidence: `views/cowork/GoalsView.tsx` registered at `ViewRegistry.tsx:585-588` (route `'goals'`) is dead code (zero dispatchers to the bare `'goals'` key). But the *real*, live goals UI is a tab inside `AutomationTasksView` — `ViewRegistry.tsx:726-730`, route `'goals-list'` → `<AutomationTasksView initialTab="goal" />`, reachable from the same "Automation Tasks" nav entry covered in item 4. Functionally this is the same underlying item as #4 (Cron), just a different tab of the same merged component. Same iOS branch-state caveat applies: this checkout has no Automation Tasks surface on iOS at all currently.

Recommended next action: `close` (duplicate of item 4's underlying gap, not a separate feature).

## 13. Cowork Wiki section viewer — PARTIAL → iOS

**Classification: STALE** (real feature, wrong surface — recategorize)

Evidence: `views/cowork/WikiSectionViewer.tsx` is real and live, but rendered inside `ArtifactDetailView.tsx:577` (`<WikiSectionViewer pageId={body} />`), which is mounted app-wide via `shell/ArtifactSidecar.tsx`, not inside Cowork's own nav. It happens to live in the `views/cowork/` folder but is not a Cowork-scoped feature. gizzi-code's `vault.ts` (unwired top-level TUI command) is a loose, currently-inactive analog.

Recommended next action: `close` as a Cowork item; if iOS parity for the artifact/wiki sidecar viewer is wanted, `defer to <phase>` under "Artifacts Library" or "Live Artifact Editor" scope instead (rows 2/59 in the tracker), not under Cowork.

## 14. Cowork Audit log viewer — GAP → iOS, gizzi-code

**Classification: STALE**

Evidence: `views/cowork/AuditLogViewer.tsx` is imported and rendered only inside `views/cowork/TasksView.tsx:874` — and `TasksView.tsx` (route `'cowork-tasks'`, `ViewRegistry.tsx:600-604`) itself has **zero dispatchers**: confirmed by reading `CoworkProjectView.tsx`, whose "Tasks"/"Agent Tasks" tabs (lines 59-302) are a self-contained inline implementation that does **not** import `TasksView`. So `AuditLogViewer` is transitively unreachable — dead code nested inside dead code. No audit-trail browser exists live on any surface; gizzi-code logs actions to a local DB without surfacing them either.

Recommended next action: `close` current framing; `defer to <phase>` if a real audit-trail browser is wanted (genuinely useful, just not what's described as an existing web feature).

## 15. Intelli-Schedule panel — GAP → iOS

**Classification: REAL** (gizzi-code side confirmed) / web comparison is STALE

Evidence: `views/cowork/IntelliSchedulePanel.tsx` is, like Audit log viewer, only rendered inside dead `TasksView.tsx:281` — unreachable on web. But gizzi-code genuinely has the named engine: `cmd/gizzi-code/src/scheduler/IntelliScheduleEngine.ts` plus a TUI screen `cmd/gizzi-code/src/screens/IntelliTaskScreen.tsx`. So the audit's claim "gizzi-code has the actual named engine, iOS doesn't" holds — this is a real, live, CLI-side capability with no iOS equivalent, independent of whether web's panel is reachable.

Recommended next action: `build` (iOS: surface `IntelliScheduleEngine`'s scheduling suggestions, likely as part of item 1's Cowork workspace expansion or item 4's Automation Tasks work) — reasonable to bundle with item 1/4 rather than as a standalone panel.

## 16. Harness Config panel — GAP → iOS

**Classification: STALE** (real feature, wrong surface — recategorize)

Evidence: `views/cowork/HarnessConfigPanel.tsx` is real and live, but mounted in `views/OperatorBrowserView.tsx:348` and `views/design/DesignModeView.tsx:994` (both pass `agentId={selectedAgent.id}`) — Operator/Browser mode and Design mode, not Cowork, despite the file living in `views/cowork/`. gizzi-code's teleport/environment-runner tooling is adjacent infrastructure, not a direct match, consistent with the original audit note.

Recommended next action: `close` as a Cowork item; if iOS parity is wanted, `defer to <phase>` and rescope under "Operator Browser" (row 46) or "Design Mode" (rows 47-52) instead of Cowork.

---

## Summary

| # | Item | Verdict | Action |
|---|------|---------|--------|
| 1 | Cowork workspace (CoworkRoot) | REAL | build |
| 2 | Cowork Runs view | STALE | close (residual need: defer) |
| 3 | Cowork Drafts view | STALE | close |
| 4 | Cowork Cron view | STALE (renamed) | close; reconcile iOS Automation Tasks branch state |
| 5 | Cowork Project view | REAL | build / defer to gizzi-code CLI phase |
| 6 | Cowork Documents view | STALE | close (defer if re-scoped) |
| 7 | Cowork Tables view | STALE | close |
| 8 | Cowork Files view | STALE | close |
| 9 | Cowork Exports view | STALE | close (defer if re-scoped) |
| 10 | Cowork Insights panel | STALE | close (defer if re-scoped) |
| 11 | Cowork Activity panel | STALE | close |
| 12 | Cowork Goals panel | STALE (dup of #4) | close |
| 13 | Cowork Wiki section viewer | STALE (recategorize) | close under Cowork; defer under Artifacts Library |
| 14 | Cowork Audit log viewer | STALE | close (defer if re-scoped) |
| 15 | Intelli-Schedule panel | REAL | build (bundle with #1/#4) |
| 16 | Harness Config panel | STALE (recategorize) | close under Cowork; defer under Operator/Design |

Net effect: of the original 16 flagged items, **2 are confirmed real, buildable gaps** (Cowork workspace expansion, Cowork Project view on gizzi-code, plus Intelli-Schedule as a bundle-in = effectively 3 build-worthy items), **1 is a rename** (Cron → Automation Tasks, already tracked elsewhere), **2 are real features living on the wrong surface** (Wiki viewer, Harness Config — not Cowork's problem), and **10 are dead code on web itself** (registered in `ViewRegistry.tsx` but never dispatched anywhere), meaning the audit's "web has it, iOS/gizzi-code don't" premise doesn't hold for them.
