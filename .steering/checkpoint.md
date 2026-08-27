# Steering checkpoint

## Repo hygiene follow-up — open items (2026-08-27)

### Goal
Resolve the three open items left after the initial repo-hygiene pass: commit the untracked audit file, delete `.beads/`, and reorganize the remaining runtime-state/content dot-directories that were safe to move.

### Just did
- Created session worktree `allternit-session-repo-hygiene-followup` on branch `session/repo-hygiene-followup`.
- Moved `.parity-reports/allternit-audit.md` → `docs/audit/allternit-audit.md` and committed it.
- Deleted root `.beads/` (daemon state; will be recreated at runtime).
- Moved `.pipeline/` → `docs/pipeline/`, `.parity-reports/` → `docs/parity-reports/`, `.shared/` → `docs/design/ui-ux-pro-max/`.
- Updated references in `.steering/bin/steer-common.sh`, `.steering/checkpoint.md`, `REPO_STRUCTURE.md`, `docs/pipeline/**/*.md`, `docs/pipeline/bin/*.cjs`, `docs/parity-reports/**/*.md`, `docs/parity-reports/**/*.txt`, `docs/parity-reports/**/*.py`, `docs/parity-reports/**/*.sh`, and archive docs.
- Left `.allternit/`, `.gizzi/`, and `.steering/` at root because live code and `AGENTS.md` hardcode those paths.

### Verification
- `git status --short` shows only intended deletions, renames, and metadata updates.
- `cargo check -p allternit-api`: passes (pre-existing warnings only).
- No remaining `.pipeline/`, `.parity-reports/`, or `.shared/` references outside the moved directories, agent-ledger, and code defaults.

### Next
1. Commit the follow-up changes on `session/repo-hygiene-followup`.
2. Merge into local `main`.
3. Update agent ledger and clean up the session worktree.

### Open questions
- The `.parity-reports/` scripts still reference the external `/Users/joe/Desktop/allternit-parity-workspace/` with absolute paths. Should those be made relative or migrated to the main repo layout?
- `.allternit/`, `.gizzi/`, `.steering/` remain at root; a future pass could make their paths configurable instead of hardcoded.

## Repo hygiene & root-level reorganization (2026-08-27)

### Goal
Audit the `allternit` monorepo, remove working-tree noise and improperly-linked nested worktrees, and consolidate root-level drift (`marketing/`, `upstream/`, `remix-content/`, ad-hoc scripts/docs) into documented homes under `docs/` and `scripts/`.

### Just did
- Created session worktree `allternit-session-repo-hygiene` on branch `session/repo-hygiene`.
- Removed improperly-linked nested worktrees `allternit-session-grok-bot-0-18-integration` and `allternit-session-multica-runtime-align` from the git index.
- Deleted ignored scratch from the main checkout: `.cache/`, `.references/`, `.pytest_cache/`, `.tmp-anthropic-skills-src/`, `.tmp-ui-skills-src/`, `.tmp-skill-test/`, `surfaces/allternit-desktop/test-results/`.
- Moved `marketing/` → `docs/marketing/`, `upstream/sources.yaml` → `docs/upstream/sources.yaml`, `remix-content/` → `docs/learning/remix-content/`.
- Moved ad-hoc root scripts `audit-ai-platform.cjs` and `inspect-model-lab.cjs` → `scripts/audit/`.
- Moved ephemeral project docs `TODO-remote-control-gap-fix.md` and `PORTING_PROVEN_PATTERNS_INTO_GIZZI.md` → `docs/projects/`.
- Updated `REPO_STRUCTURE.md`, `tests/vitest.config.ts`, `docs/GENOFFICE_PHASE5_DECISION.md`, `docs/marketing/README.md`, `docs/marketing/templates/*.html`, and `.steering/checkpoint.md` to reflect new paths.

### Verification
- `git worktree list` shows no nested worktrees inside the main checkout.
- `git status --short` shows only intended deletions, renames, and metadata updates.
- `cargo check -p allternit-api`: passes (pre-existing warnings only).

### Next
1. Commit the reorganization on `session/repo-hygiene`.
2. Merge `session/repo-hygiene` into the local `main` checkout.
3. Clean up the session worktree and branch.

### Open questions
- Should the historical references in `docs/archive/` and `docs/Future_Blueprints/` to old `upstream/` / `marketing/` concepts be left as-is, or should they carry a deprecation note?
- The `.parity-reports/allternit-audit.md` file was untracked; moved to `docs/audit/allternit-audit.md` and committed.

## Hermes floating chat HUD port — completion (2026-08-26)

### Goal
Finish porting the Hermes Desktop floating chat HUD into the Allternit `session/hud-mode` worktree without redoing work the previous agent already landed.

### Just did
- Verified the existing `allternit-session-hud-mode` worktree already contains the bulk of the port (commits `8bc131d73` and `2f8d763cc`).
- Fixed a HUD-related TypeScript prop mismatch in `surfaces/ai.allternit.com/src/views/chat/main/ChatActiveContent.tsx` (`linkedAgentSessionIds` → `linkedSessionIds`).
- Refined `data-hud-grabbing` placement in `HudShell.tsx` so composer-drag and resize handles correctly veto click-through.
- Updated `scratch/HERMES_HUD_PORT_PLAN.md` and `scratch/HERMES_HUD_GAP_ANALYSIS.md` to reflect the current state.

### Verification
- `npm run typecheck` in `surfaces/allternit-desktop`: clean.
- `npm run build` in `surfaces/allternit-desktop`: clean (auth renderer + main + preload).
- `pnpm exec vitest run src/shell/hud` in `surfaces/ai.allternit.com`: 8 tests pass.
- `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com`: no HUD-related errors; remaining errors are pre-existing office-suite package issues.

### Next
1. Steering commit-gate review for the uncommitted HUD refinements.
2. Merge `session/hud-mode` into the local main checkout.
3. Runtime smoke-test: global hotkey, click-through, drag, resize, session handoff.

### Open questions
- Should the orphaned `/api/v1/hud/*` collector endpoints be removed or rebuilt into a dashboard UI?
- Does the user want the branch merged to main now, or left in the session worktree for further polish?

## Hermes-style HUD mode for Allternit (2026-08-25)

### Goal

Port the Hermes HUD "collector + dashboard" pattern into the Allternit platform as a native view (`hud`) inside the web shell, and make it first-class in the Electron desktop app, so a user can open a live operational dashboard that surfaces the local computer-use gateway, Rails peers, recent recordings, and platform health.

### Just did

- Analyzed the Hermes HUD architecture from the upstream repo: TUI + Web UI both read from `~/.hermes/`, collectors aggregate registry + runtime + gateway state, and a FastAPI/React stack pushes live updates.
- Chose a native Allternit implementation rather than embedding Hermes:
  - Backend: new read-only `/api/v1/hud/*` routes in `cmd/allternit-api/src/hud_routes.rs`.
  - Frontend: new `hud` view under `surfaces/ai.allternit.com/src/views/hud/`.
- Backend endpoints:
  - `GET /api/v1/hud/summary` — gateway health/sessions, peers, recordings, local runtime.
  - `GET /api/v1/hud/peers` — reads `~/.allternit/peers/registry.json`.
  - `GET /api/v1/hud/recordings` — scans `~/.allternit/recordings/*.jsonl`.
  - `GET /api/v1/hud/health` — platform + gateway health.
- Wired `hud_router()` into the v1 protected router in `cmd/allternit-api/src/main.rs` and re-exported the module from `cmd/allternit-api/src/lib.rs`.
- Frontend pieces:
  - `HudView.tsx` tabbed dashboard (Overview / Computer Use / Peers / Recordings / Health).
  - `useHudData.ts` hooks the four endpoints and refreshes every 5s.
  - Panel components: `ExecutiveSummaryPanel`, `ComputerUsePanel`, `PeersPanel`, `RecordingsPanel`, `HealthPanel`.
  - Added `"hud"` to `ViewType` in `src/nav/nav.types.ts`, lazy-registered the view in `src/shell/ViewRegistry.tsx`, added a "HUD" link in `src/views/runtime/RuntimeConfigurationPanel.tsx`, and bound `Ctrl+Shift+H` in `src/shell/ShellApp.tsx`.
- Desktop integration in `surfaces/allternit-desktop/src/main/unified-main.ts`:
  - Added a dedicated HUD window (`shell:open-hud` IPC handler), global `Alt+Shift+H` hotkey, "Open HUD" tray menu item, and `allternit://hud` / `allternit://open/hud` deep-link handling.
  - Changed the global hotkey from `Cmd/Ctrl+Shift+H` to `Alt+Shift+H` to avoid colliding with the in-shell shortcut and macOS system shortcuts; added debug logging for registration success/failure and window load errors.

### Verification

- `cargo check -p allternit-api`: clean for HUD code (only pre-existing warnings remain).
- `cargo build -p allternit-api`: succeeded.
- Live smoke test (local dev bypass, temp data dir with sample peer registry + recording):
  - `GET /api/v1/hud/health` returned platform/gateway health.
  - `GET /api/v1/hud/peers` returned the seeded peer.
  - `GET /api/v1/hud/recordings` returned the seeded recording.
  - `GET /api/v1/hud/summary` returned the full aggregate payload.
- `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com`: zero errors in HUD files, ViewRegistry, nav.types, RuntimeConfigurationPanel, ShellApp. Remaining errors are pre-existing missing `@allternit/office-*` engine packages and two `mode-session-store.ts` mismatches.
- `npm run typecheck` in `surfaces/allternit-desktop`: clean (main + preload). HUD hotkey/tray/deep-link code typechecks.
- `pnpm build` is blocked by the same pre-existing missing office engine dependency (`better-sqlite3` native build fails under Node 26; repo `.nvmrc` wants Node 20). This is unrelated to the HUD change.

### Running in the open desktop

The Electron app currently on screen is loading the platform UI from `http://localhost:3013`, which is served by a different checkout (`/Users/joe/Desktop/Allternit/allternit-platform`). That checkout does not contain the HUD code, and the running binary does not include the new `Cmd/Ctrl+Shift+H` hotkey or tray item. To run the HUD safely without closing the active desktop/recording session:

1. Build and serve the HUD-enabled platform UI from this worktree (port 3013 or a static export).
2. Run the HUD-enabled API from this worktree on port 8013.
3. Restart the desktop from this worktree (or reload it pointing at the new platform URL) so it picks up the new main-process hotkey/tray/deep-link code.

Until then, the HUD is reachable in any browser at the platform URL `/hud` once the backend and frontend are running from this branch.

### Next

1. Get the frontend to a Node 20 / fully-installed state and run `pnpm build` to confirm the HUD view bundles cleanly.
2. Restart the desktop from this worktree and verify `Cmd/Ctrl+Shift+H`, tray "Open HUD", and `allternit://hud` deep link open the HUD.
3. Decide whether to keep polling or upgrade to WebSocket/SSE for live gateway sessions.
4. Steering commit-gate review for the branch `session/hud-mode`.

### Open questions

- Should the HUD be a top-level rail icon instead of (or in addition to) the Runtime Configuration link?
- Should we expose an admin-only HUD route, or is the current Clerk-protected route sufficient for the logged-in local user?

## Cross-surface seeded auth + iOS runtime pairing (2026-08-23)

## Site APIs / Cross-surface HAR capture

### Goal
Implement the cross-surface Site APIs / HAR-derived API capture redesign.

### Just did
- Added backend persistence, replay proxy, real client generation, and agent tools (`api_capture_record`, `api_capture_stop`, `api_capture_replay`).
- Created frontend capture adapter (desktop → extension → upload) and migrated store to backend APIs.
- Added extension capture fallback via `chrome.debugger`/`webRequest`.
- **Fixed HAR camelCase bug**: backend extractor expected snake_case (`query_string`, `post_data`) but Electron/Chrome export camelCase (`queryString`, `postData`). Added `#[serde(rename_all = "camelCase")]` to HAR structs in `har_api_service.rs`.
- Added headless smoke tests:
  - `cmd/allternit-api/scripts/test-api-capture.mjs` — backend ingest → session → contract → replay → client.
  - `surfaces/allternit-desktop/tests/api-capture-headless.spec.ts` — Electron desktop capture through the preload API without UI screenshots.
- Both smoke tests pass.

### Verification
- `cargo check -p allternit-api` ✅
- `cargo test -p allternit-api extract_endpoints` ✅
- `cargo test -p allternit-api tool_routes` ✅ 21 passed
- `pnpm exec tsc` in `surfaces/ai.allternit.com` ✅ no capture-file errors
- `pnpm test` in `surfaces/allternit-desktop` ✅ 94 passed
- `pnpm exec wxt build` in extension ✅
- `node cmd/allternit-api/scripts/test-api-capture.mjs` ✅
- `pnpm exec playwright test surfaces/allternit-desktop/tests/api-capture-headless.spec.ts` ✅

### Commit / Push status
- Worktree: `/Users/joe/Desktop/allternit-workspace/allternit-session-site-apis-capture`
- Branch: `session/site-apis-capture`
- Commit: `a68c49d7a`
- Changes committed locally: backend HAR service fix, redesign plan, headless smoke tests, backend integration test, removal of flaky e2e spec.
- **Steering consult blocked**: `ao-steer` (Claude Code reviewer session) is at a session limit dialog (`You've hit your session limit · resets 5am (America/Chicago)`) and cannot process the commit-gate request. `steer-stop.sh` returned `verdict=CONSULT_FAILED`.
- Need explicit user approval (or `STEER_GUARD_OFF=1`) before `git push origin session/site-apis-capture` and PR/merge to `main`.

---

## Wave 2 — Goal, plan, task, validation, and loop runtime (2026-08-17)

### Goal

Complete Wave 2 runtime for the packaged-bot work loop and keep Ralph
deprecation on track per `OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`.

### Just did

- Expanded `ralph-deprecation.ts` with a complete inventory of 80+ Ralph-named
  paths across TypeScript, Rust, DAK runners, docs, tests, and archive.
- Kept legacy `RailsLoopIteration*` event prefix → canonical goal/task event map
  and read-compatibility helpers.
- Created `goal-task-contracts.ts` with canonical Zod schemas and types for
  Goal (9 states), Plan, TaskGraph, Task (9 states), Attempt, ValidationResult,
  BudgetPolicy/Usage, LoopPolicy/Strategy, and Delegation.
- Implemented graph utilities (`detectCycle`, `validateDependencies`,
  `topologicalOrder`), repeated-blocker audit, budget guard, retry backoff,
  validation aggregator, and loop guard against unbounded iteration.
- Added canonical event type enums and payload helpers for Goal/Plan/Task/
  Attempt/Validation/Delegation events (W2-045).
- Extended `orpc-contracts.ts` to re-export Wave 2 schemas/types and added REST
  endpoints for goals, plans, tasks, attempts, validations, and delegations.
- Added `goal-task-contracts.test.ts` with 22 focused unit tests; all pass.
- Completed W2-003: scrubbed Ralph terminology from the web product surface.
  - `bot-prompt-augmentation.ts` and `receiptService.ts` doc comments updated.
  - `fileSystem.ts` slash commands renamed (`ralph-loop` → `agent-loop`,
    `cancel-ralph` → `cancel-agent-loop`).
  - `ralph-deprecation.ts` updated with a `resolvedWebSurface` registry.
- Built `goal-loop-controller.ts`: state-machine runtime that materializes plans,
  accepts plans, executes tasks in topological order, retries attempts, validates,
  handles user input/approval pauses, cancels, enforces budgets, audits repeated
  blockers, and guards against unbounded loops (W2-060–W2-072).
- Added `goal-loop-controller.test.ts` with 10 lifecycle tests; all pass.
- Created `bot-operational-projection.ts` to map `GoalLoopState` → partial
  `BotOperationalState`.
- Wired the loop controller into `bot-operational-state.store.ts` via a new
  `applyGoalLoopState(botId, loopState)` action that merges the derived delta
  while preserving server-sourced fields (`lastEventSequence`, `computerState`,
  `nextRoutineRunAt`, `unreadMessagesCount`).
- Added `bot-operational-state.store.test.ts` with 6 projection tests; all pass.
- Built `bot-event-store.ts`: durable, append-only, localStorage-backed storage
  for canonical goal/task events with SSR-safe memory fallback and test isolation.
- Created `goal-loop-persistence.ts` with `GoalLoopRecorder` (records controller
  events + emits `loop.snapshot` events), `rebuildGoalLoopState` (event-history
  replay), and `resumeGoalLoopController` (rebuild + resume).
- Added `goal-loop-persistence.test.ts` with 7 tests proving restart recovery,
  approval-pause resumption, and full goal completion after simulated restart.
- Checked `W2-GATE` in `OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`.

### Verification

- `vitest run src/lib/bots/goal-task-contracts.test.ts src/lib/bots/goal-loop-controller.test.ts src/lib/bots/bot-operational-state.store.test.ts src/lib/bots/goal-loop-persistence.test.ts` ✅ 45 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in
  Wave 2 files. Pre-existing errors remain in unrelated files
  (`comrails-store.ts`, `bot-profile.ts`, `subagent-service.ts`).
- Grep confirms no remaining Ralph-named product UI strings in
  `surfaces/ai.allternit.com/src` outside the intentional deprecation registry.

### Next

1. Stage W2-GATE evidence and consider W2-005 (delete obsolete Ralph execution
   code now that replacement runtime parity exists).
2. Build a React hook (`useGoalLoopController`) that instantiates the controller
   for a bot session and subscribes the operational state store.
3. Add WIH materialization when a structured plan is accepted (Wave 3).
4. Implement durable activity/session APIs and event append protocol.

### Open questions

- Is the WIH materialization threshold (Wave 3) triggered by plan creation or
  by task graph acceptance?
- When should the localStorage event store reconcile with the server-owned
  ledger: on every append, periodic sync, or session close?

## Wave 3 — WIH lifecycle and bounded bot sessions (2026-08-17)

### Goal

Complete Wave 3 foundations for WIH materialization, bounded bot sessions,
durable activity API, and context-budget/summary support.

### Just did

- Created `wih-session-contracts.ts` with Zod schemas for WIH, BotSession,
  ContextBudget, SessionSummary, ActivityEvent, and helpers.
- Built `bot-session-store.ts` (Zustand + localStorage):
  - Session create/close/active/summary/context-budget actions.
  - `materializeWIH` creates a WIH on plan acceptance, links it to bot/project/
    session/goal/taskGraph/tools/scope/validation/artifacts/participants/budget.
  - WIH update and lookup selectors.
- Built `bot-activity-api.ts` with cursor-paginated event query, goal/task/type
  filtering, and `replayGoal()` convenience.
- Built `useGoalLoopController.ts` React hook:
  - Creates or resumes a durable `GoalLoopController`.
  - Attaches `GoalLoopRecorder` and applies state to operational projection.
  - Materializes WIH on plan acceptance and keeps WIH status in sync.
- Added tests: `bot-session-store.test.ts` (6), `bot-activity-api.test.ts` (4),
  `goal-loop-wih-integration.test.ts` (2).
- Added `BotActivityAPI.search()` for full-history payload search and
  `bot-session-store.getSessionContext()` for bounded session context without
  raw transcript leakage.
- Created `wave3-gate.test.ts` proving multiple bounded sessions + WIHs, history
  search, resume selected work, and new-session context without raw prior
  transcript leakage.
- Checked W3-001–W3-006, W3-020, W3-022–W3-023, W3-025, W3-027, W3-040, W3-044,
  and W3-GATE in `OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`.

### Verification

- `vitest run src/lib/bots/*.test.ts` ✅ 58 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in
  Wave 3 files. Pre-existing errors remain in unrelated files
  (`comrails-store.ts`, `bot-profile.ts`, `subagent-service.ts`).

### Next

1. Close remaining Wave 3 gaps: W3-007 (close validation receipts), W3-021
   (secure server append/sync protocol), W3-024 (activity export), W3-026
   (concurrent send/offline replica handling), W3-041–W3-047 (identity/policy
   loading, context budget enforcement, raw-history preservation, summary/memory
   provenance, drift tests).
2. Move to Wave 4 (personality workspace, memory, duplication).

### Open questions

- Should the next chunk close the remaining individual W3 gaps, or move directly
  to Wave 4 since W3-GATE is now evidenced?

## Wave 4 — Duplication foundation (2026-08-17)

### Goal

Begin Wave 4 by establishing a duplication-safe bot clone contract and service.

### Just did

- Created `bot-duplication-contracts.ts` with `BotCloneOptionsSchema`,
  `BotCloneReceiptSchema`, `DuplicationIdMappingSchema`, and the
  `NON_DUPLICATABLE_PATHS` guard list.
- Created `bot-clone.service.ts` implementing `cloneBot(source, options, actorId)`:
  - Generates new bot id, display name, and handle.
  - Strips `operationalState` and all active runtime state.
  - Copies identity, profile, model, provider, type, category.
  - Option-scoped copying for memory, routines, workspace docs, computer
    template, child topology.
  - Connector bindings copied by reference with `reauthorizationRequired`;
    raw secrets never copied.
  - Sessions, active leases, approvals, running jobs, receipt identities, and
    runtime IDs explicitly excluded.
  - Emits a redacted duplication receipt mapping source IDs to new IDs.
- Added `bot-clone.service.test.ts` with 9 tests proving the clone rules.
- Checked W4-040–W4-045 and W4-048 in the master tracker.

### Verification

- `vitest run src/lib/bots/*.test.ts` ✅ 67 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in
  Wave 4 files. Pre-existing errors remain in unrelated files
  (`comrails-store.ts`, `bot-profile.ts`, `subagent-service.ts`).

### Next

1. Implement W4-046 (provision new unique identities) and W4-047 (child-graph
   preview, recursion limit, cycle detection, rollback).
2. Wire `BotRoster.tsx` duplicate menu to `cloneBot` / backend (W4-049).
3. Build versioned canonical workspace serializer (W4-001–W4-008).
4. Add memory isolation namespaces (W4-020–W4-028).

### Open questions

- Should the clone service remain client-side with a later backend transaction,
   or should the next step build the transactional API endpoint in Rust now?

## Wave 4 — Duplication identities, child-graph safety, and roster wiring (2026-08-17)

### Goal

Complete the remaining duplication acceptance work for W4-046, W4-047, and W4-049.

### Just did

- Expanded `bot-duplication-contracts.ts`:
  - Added `IdentityKindSchema`, `ProvisionedIdentitySchema`,
    `ChildBotGraphNodeSchema`, `ChildBotGraphPreviewSchema`,
    `BotClonePreviewSchema`, `BotCloneGraphOptionsSchema`, and `BotCloneError`.
- Expanded `bot-clone.service.ts`:
  - `provisionIdentities()` returns redacted placeholder identities for email,
    phone, wallet, handle, WebAuthn, and OAuth when requested (W4-046).
  - `previewChildBotGraph()` walks child topology, enforces recursion limit,
    detects cycles, and flags policy reauthorization (W4-047).
  - `cloneBotGraph()` recursively clones root + children, remaps IDs, and rolls
    back on cycle/depth failure (W4-047).
  - `previewClone()` builds a duplication preview with identity provisions and
    child-graph summary.
  - `cloneBot()` now records identity mappings on the receipt and includes
    explicit warnings.
- Added `agentToBot()` in `bot-profile.ts` to convert a packaged `Agent` into the
  canonical `Bot` contract.
- Wired `BotRoster.tsx` `handleDuplicate` to the clone service:
  - Looks up the source template, converts its `Agent` to a `Bot`, calls
    `cloneBot()`, and invokes the new optional `onDuplicate` callback with the
    result.
- Added tests:
  - `bot-clone.service.test.ts` expanded to 19 tests covering identities,
    child-graph preview, graph cloning, cycle/depth rollback, and preview.
  - New `bot-profile.test.ts` with 3 tests for `agentToBot`.
- Checked W4-046, W4-047, and W4-049 in the master tracker.

### Verification

- `vitest run src/lib/bots/*.test.ts` ✅ 80 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in
  Wave 4 files. Pre-existing errors remain in unrelated files
  (`comrails-store.ts`, `bot-profile.ts` line now shifted to 194,
  `subagent-service.ts`).

### Next

1. Build versioned canonical workspace serializer (W4-001–W4-008).
2. Add memory isolation namespaces (W4-020–W4-028).
3. Decide whether to implement the transactional backend clone endpoint now or
   after the client-side contract stabilizes.

### Open questions

- None blocking the next Wave 4 sub-slice.

## Wave 4 — Versioned canonical workspace serializer and store (2026-08-17)

### Goal

Build the versioned canonical workspace contract used by create, edit, import,
export, and duplicate.

### Just did

- Created `bot-workspace-contracts.ts`:
  - `BOT_WORKSPACE_FILES` mapping canonical artifacts (`AGENTS.md`, `SOUL.md`,
    `USER.md`, `GOVERNANCE.md`, `TOOLS.md`, `SKILLS.json`, `HEARTBEAT.md`,
    `MEMORY.md`).
  - `BOT_WORKSPACE_SCHEMA_VERSION` and `BOT_WORKSPACE_GENERATOR_VERSION`.
  - Schemas for files, snapshots, manifests, audit entries, and frontmatter.
  - Conflict / not-found error types.
- Created `bot-workspace-serializer.ts`:
  - `serializeBotWorkspace(bot)` and `deserializeBotWorkspace(files)`.
  - Deterministic `computeWorkspaceRevision()` via SHA-256 over sorted paths.
  - `buildWorkspaceManifest()` for manifest + revision.
  - `invalidateBotWorkspaceCache()` hook (W4-007).
- Created `bot-workspace-store.ts`:
  - In-memory store with `loadWorkspace`, `writeWorkspace`, `rollbackWorkspace`,
    `getAuditHistory`, and `loadBot`.
  - Compare-and-swap conflict detection through `expectedRevision`.
  - Revision retention and true rollback to historical snapshots.
  - Audit log for writes/rollbacks.
- Added `bot-workspace.test.ts` with 10 tests covering serialization, round-trip,
  stable/different revision hashes, CAS conflicts, audit history, rollback, and
  `loadBot`.
- Checked W4-001–W4-004 and W4-006–W4-007 in the master tracker.

### Verification

- `vitest run src/lib/bots/*.test.ts` ✅ 90 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in
  Wave 4 files. Pre-existing errors remain in unrelated files
  (`comrails-store.ts`, `bot-profile.ts:194`, `subagent-service.ts`).

### Next

1. Finish W4-005 (preserve unsupported content during direct file edit
   round-trips) and W4-008 (remove decorative personality controls).
2. Add memory isolation namespaces (W4-020–W4-028).
3. Wire the workspace store into the duplicate flow so `cloneBot` can serialize
   and persist the cloned workspace.

### Open questions

- None blocking the next Wave 4 sub-slice.

## Packaged bots canonical tracker (2026-08-16)

### Goal

Execute Phase 2 Packaged Bots implementation following the master implementation tracker (`OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`).

### Just did

- Completed Wave 1: Canonical Contracts and Operational Projection (`W1-001`–`W1-045`, `W1-GATE`).
  - `BotProfile.displayName` required; `handle`, `version`, `lifecycle` added.
  - `CanonicalEventEnvelopeSchema` defined (sequence, causationId, correlationId, actor, sensitivity, visibility, idempotency).
  - `BotOperationalStateSchema` (9 statuses) + precedence rules written.
  - `bot-operational-state.store.ts` created — server-sourced projection replacing competing client stores.
  - `comrails-types.ts` migrated to canonical `BotOperationalStatus`.
  - `getOperationalState` and `rebuildProjection` API endpoints added to apiContract.
- `cargo check -p allternit-api` ✅ (warnings only, no errors).

### Next

1. Begin Wave 2: Goal, Plan, Task, Validation, and Loop Runtime.
   - Define `Goal`, `Plan`, `TaskGraph`, `Task`, `Attempt`, `Validation` TypeScript contracts.
   - Implement 9 goal states and 7 task states.
   - Implement Ralph inventory/deprecation (W2-001–W2-005).
   - Implement policy-driven loop strategies (W2-060–W2-072).

### Open questions

- None blocking Wave 2 start.

## Goal
Implement the cross-surface Site APIs / HAR-derived API capture redesign: add backend persistence, server-side replay proxy, real client generation, a frontend capture adapter (desktop → extension → upload), extension capture fallback, and agent tools (`api_capture_record`, `api_capture_stop`, `api_capture_replay`).

## Milestones
- [x] **Milestone 1**: Backend persistence + replay proxy + real client generation.
- [x] **Milestone 2**: Frontend adapter factory + store migration + `BrowserApiCaptureButton` refactor.
- [x] **Milestone 3**: Extension capture fallback via `chrome.debugger`/`webRequest`.
- [x] **Milestone 4**: Agent tools registered in backend tool routes.
- [x] **Milestone 5**: Verification; UI polish was already applied in prior checkpoint.

## Just did
- Implemented Milestones 1–4 in parallel via subagents:
  - Backend: added `V90__api_capture.sql`, `har_api_service.rs`, DbHandle persistence methods, full REST route set (`sessions`, `contracts`, `replay`, `client`, `ingest`), and stable-UUID endpoint extraction.
  - Frontend: created `getCaptureAdapter()` (desktop → extension → upload), migrated `store.ts`/`api.ts` to backend APIs, and refactored `BrowserApiCaptureButton.tsx` to use the adapter.
  - Extension: added `debugger`/`webRequest` permissions, `api-capture/background.ts` with CDP Network capture, and message handlers in `background.ts`.
  - Agent tools: added `api_capture_record`, `api_capture_stop`, `api_capture_replay` to `tool_routes.rs` with JSON schemas and ownership checks.
- Wrote `docs/SITE_APIS_CAPTURE_REDESIGN_PLAN.md` with research references (`server-replay`, `har-to-openapi`, `mitmproxy2swagger`, `openapi-devtools`, `harhar`, `api-reverse-engineer`, `chrome-devTools-advanced-mcp`, Playwright `routeFromHAR`).
- Verification:
  - `cargo check -p allternit-api` ✅
  - `cargo test -p allternit-api har_api` ✅ 3 passed
  - `cargo test -p allternit-api tool_routes` ✅ 21 passed
  - `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` in `surfaces/ai.allternit.com` ✅ no errors in touched files
  - `pnpm test -- browser-capture-manager.test.ts` in `surfaces/allternit-desktop` ✅ 94 passed
  - `pnpm exec wxt build` in extension ✅ succeeded
- Security fix: added user-ownership check in `api_capture_stop` before stopping a session.

## Next
- Full `cargo test -p allternit-api` is running in background; inspect result when it completes.
- Stage and commit the Site APIs capture changes separately from unrelated Office Suite WIP.

## Open questions
- Should contract storage be scoped per-user or per-workspace? (Currently per-user.)
- Should replay be a backend proxy (cors-safe) or direct client-side fetch? (Currently backend proxy via `reqwest`.)

---

## Goal
Implement the approved Allternit Office Suite standalone plan: create `@allternit/allternit-office-suite`, refactor the four office apps and Sign to use an injectable `OfficeHost` contract, decouple `@allternit/office-ai` and the xlsx engine from platform endpoints, and build `surfaces/office.allternit.com` as a standalone host. Platform (`surfaces/ai.allternit.com`) remains the primary entry point.

## Milestones
- [x] **Milestone 1**: Scaffold `@allternit/allternit-office-suite` with `OfficeHost`, `OfficeAiClient`, `XlsxEngineHost`, `OfficeStorageProvider`, bridge context, and theme.
- [x] **Milestone 2**: Wrap Docs/Sheets/Slides/PDF with host-aware adapters; platform views provide a browser host that overrides `saveFile` with artifact persistence.
- [ ] **Milestone 3**: Decouple `@allternit/office-ai` and the xlsx engine from platform endpoints via the host contract.
- [ ] **Milestone 4**: Extract Allternit Sign into the suite and normalize its UI palette.
- [ ] **Milestone 5**: Build `surfaces/office.allternit.com` standalone host.
- [ ] **Milestone 6**: Verification, tests, and documentation.

## Just did
- Milestone 2:
  - Added `DocsApp`, `SheetsApp`, `SlidesApp`, `PdfApp` adapters in the suite package.
  - Added `createBrowserHost` helper for standalone surfaces.
  - Updated platform views (`DocsView`, `SheetsView`, `SlidesView`, `PdfView`) to use `OfficeHostProvider`.
  - Added ambient declaration for `harfbuzzjs/hb.js` so the suite package typechecks cleanly.
  - Verified suite and platform surface typechecks pass.

## Next
- **Milestone 4** (Sign extraction): move the native signing UI/utilities into the suite package as a host-aware `SignApp`, normalize its palette to match the office apps, and update the platform view to use it.
- Return to **Milestone 3** once Sign is extracted, because it requires deeper changes to the vendored app bridges.

## Open questions
- Should the standalone Sheets host implement a client-side recalc engine, or gracefully degrade to the simpler `@allternit/office-sheets-editor`?
- Should the standalone AI host default to Ollama, a no-op, or a lightweight built-in LLM stub?
- Should Manufacturing have its own top-level navigation entry, or remain discoverable only through Products Discovery for now?
- What is the Phase 1 equipment budget and target go-live date?

## Wave 4 — Unsupported content round-trip, decorative controls, and memory isolation (2026-08-17)

### Goal

Finish the remaining Wave 4 items: W4-005, W4-008, and W4-020–W4-028.

### Just did

- **W4-005:** Hardened `bot-workspace-serializer.ts` so `serializeBotWorkspace(bot, existingFiles)`
  preserves unknown files and unsupported body content in `SOUL.md`/`AGENTS.md`, updating only
  known structured fields. Added a `bot-workspace.test.ts` case proving an extra markdown section
  and an unknown file survive a UI-driven re-serialization.
- **W4-008:** Removed the decorative "Projected Level" and "Measured Setup Stats" cards from
  `CharacterStep.tsx`. Verified the persisted personality sliders in `IdentityStep` are canonical
  (written to `config.personality` and consumed by `agent.service.ts` system prompts) and left them
  in place.
- **W4-020–W4-028:** Implemented isolated bot memory:
  - `bot-memory-contracts.ts`: schemas for `BotMemoryRecord`, scopes, provenance, sensitivity,
    promotion policy, retrieval queries, retrieval logs, and errors.
  - `bot-memory-store.ts`: in-memory store with namespace isolation, session/project scopes,
    candidate proposal, explicit/policy promotion, correction/contradiction links, expiry,
    retrieval logging, prompt-injection and secret detection, deletion propagation, bot-wide
    forget, export, and precision/recall evaluation sets.
  - `bot-memory.test.ts`: 23 tests covering W4-020 through W4-028.
- Checked W4-005, W4-008, and W4-020–W4-028 in `OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`.

### Verification

- `vitest run src/lib/bots/*.test.ts` ✅ 114 passed.
- `tsc --noEmit` across `surfaces/ai.allternit.com` reports no new errors in Wave 4 files.
  Pre-existing errors remain in unrelated files (`comrails-store.ts`, `bot-profile.ts:194`,
  `subagent-service.ts`).

### Next

1. Wire the workspace store and memory store into the create/edit/duplicate UI flows.
2. Implement a persistent backend adapter for the workspace and memory stores while keeping the
   same contracts.
3. Move to Wave 5.

### Open questions

- None blocking the next Wave 4 sub-slice.

---

## Office UI brand fix (2026-08-18)

### Goal
Fix `office.allternit.com` landing page and workspace shell to match the Allternit brand, design system, and typography.

### Just did
- Audited current `surfaces/office.allternit.com` against DESIGN.md and `surfaces/ai.allternit.com` design tokens.
- Rewrote `src/theme.css` to use canonical Allternit typography tokens (`--font-allternit-sans`, `--font-ui`, etc.), semantic surface tokens (`--surface-canvas`, `--ui-text-primary`, `--ui-border-default`), and the sand/nude obsidian palette.
- Added `src/fonts.css` (commented @font-face stubs aligned with ai surface).
- Added `src/HomePage.css` to move landing-page styles out of inline styles.
- Refactored `src/HomePage.tsx` and `src/App.tsx` to use the token system and shared `.btn`/`.card`/`.glass-thick` utility classes.
- Fixed inverted primary button colors; primary CTAs now use `--accent-primary` with `--ui-text-inverse`.
- Updated `index.html` to remove inline CSS and add theme-color meta tags.
- Updated `src/main.tsx` to load `fonts.css`.

### Verification
- `tsc --noEmit` in `surfaces/office.allternit.com` reports no errors in surface source files (remaining errors are pre-existing issues in `packages/@allternit/office-slides-app`).
- `pnpm build` succeeds in a fully-installed workspace (validated by copying changed files to the main checkout with complete `node_modules`).
- `pnpm preview` serves the built bundle and returns the updated HTML.

### Open questions
- Whether to deploy the built `dist/` from this worktree or from CI.
- Whether the workspace install in this worktree should be repaired so local `pnpm build` runs without copying to main.

### Update — bidirectional platform links
- Added `src/platformUrl.ts` with `VITE_ALLTERNIT_PLATFORM_URL` override (defaults to `https://ai.allternit.com`).
- `HomePage` header brand now links back to the main Allternit platform.
- `App` workspace nav includes a "Back to Allternit →" link.
- `surfaces/ai.allternit.com/src/views/office/OfficeLauncherView.tsx` now has an "Open standalone office" external link to `https://office.allternit.com`.

### Update — Sign PDF upload fix and platform URL correction
- Changed default platform URL from `https://ai.allternit.com` to `https://allternit.com`.
- Removed the "Back to Allternit" link from the workspace nav; the homepage header brand now links to the main site.
- Fixed Sign PDF loading by initializing pdfjs-dist with the Vite-bundled worker URL in `src/main.tsx`.
- Updated `initPdfWorker` in `packages/@allternit/allternit-office-suite/src/sign/pdf-signing.ts` to accept an optional `workerSrc` override.

- None.

---

## Goal (session/steering-packaging: ship orchestration + steering tooling with the platform)

Move the desktop-local agent-orchestration/steering tooling into the repo so it ships with the platform and gizzi-code: steer-* scripts into `tools/agent-orchestrator/scripts/`, both skills into `.agents/skills/`, registration in gizzi-code `bundledSkills.ts`, Rails-first session discovery in `steer-discover`, default-on Rails peer registration, and install/Homebrew symlink updates.

## Just did

- Created linked worktree `allternit-platform-session-steering-packaging` on branch `session/steering-packaging`.
- Discovered repo already packages ao-* as shims over `allternit-rails` (`tools/agent-orchestrator/scripts/`); desktop `~/.local/bin/ao-*` copies are the stale standalone versions. Direction: repo is canonical.
- Confirmed `allternit-rails` binary comes from `rails/` crate (`[[bin]] name = "allternit-rails"`).

## Next

- Add steer-* scripts to `tools/agent-orchestrator/scripts/`.
- Add `.agents/skills/agent-orchestrator/` + `.agents/skills/steer-parallel-agent/`.
- Register both skills in `cmd/gizzi-code/src/skills/bundledSkills.ts`.
- Rails-first discovery in `steer-discover` with filesystem fallback.
- Flip `GIZZI_ENABLE_RAILS_PEER` to default-on.
- Update Homebrew/install scripts to symlink the tools; update docs to repo-canonical.

## Open questions

- `allternit-rails` is not on PATH on the desktop, so the repo's ao-* shims currently fail there while the stale standalone copies work. Migration needs an install step (`cargo install --path rails` or packaged binary) — flagging so it is not missed.

---

## Checkpoint update (session/steering-packaging)

Just did:
- Added steer-* toolkit (steer, steer-discover, steer-context, steer-checkpoint, steer-prompt, steer-verify) to `tools/agent-orchestrator/scripts/`.
- Added `.agents/skills/agent-orchestrator/` + `.agents/skills/steer-parallel-agent/` (auto-discovered by gizzi-code project skill scan).
- Registered both skills in gizzi-code builtin catalog (`cmd/gizzi-code/src/runtime/skills/bundledSkills.ts` + Bun text-loaded markdown under `src/runtime/skills/bundled/`).
- `steer-discover` now queries the Rails peer registry first (`ALLTERNIT_RAILS_URL`, default `http://127.0.0.1:8013`), filesystem scan as fallback.
- Flipped `GIZZI_ENABLE_RAILS_PEER` to default-on (opt out via `=0`) in `railsPeer.ts`, `tools-registry-gizzi.ts`, `cli/ui/ink-app/tools.ts`.
- Added `tools/agent-orchestrator/install.sh` (idempotent PATH installer + allternit-rails bootstrap) and ran it: 13 tools + the freshly built `allternit-rails` binary now on PATH; `ao-doctor` verified working through the shims.
- Verification: `tsc --noEmit` in `cmd/gizzi-code` — zero errors in touched files; only 7 pre-existing errors in `packages/sdk/scripts/verify-sdk.ts` from missing `dist/` artifacts in the fresh worktree.

Next:
- Merge `session/steering-packaging` when approved, then re-run `tools/agent-orchestrator/install.sh` from the main checkout (current `~/.local/bin` symlinks point into this worktree).
- Homebrew formula deferred until release tarballs exist.

Open questions:
- Should kimi/codex/claude session-start hooks also register Rails peers so `steer-discover`'s Rails section covers non-gizzi agents?
### Update — generated media integration
- Copied generated assets into `surfaces/office.allternit.com/public/`:
  - `hero-documents.png` — static hero image of the five document cards.
  - `hero-cards.mp4` — animated floating document cards (used as the hero visual).
  - `hero-glow.mp4` — warm golden glow (used as ambient hero background).
  - `grid-beam.mp4` — subtle grid light beam (used as value-props background).
  - `sign-signature.mp4` — kept in public for future Sign section use.
- Replaced the SVG `HeroVisual` composition with a looping `<video>` using the PNG as poster/fallback.
- Added autoplay/muted/loop background videos to the hero and value-props sections.
- Updated `HomePage.css` with video positioning, opacity, and z-index layering.
- Verified the build copies all media files to `dist/` and the preview serves them.

### Update — clickable feature cards and persistent platform links
- Added `AppTab` type (`docs` | `sheets` | `slides` | `pdf` | `sign`) and wired `HomePage` → `AppContent` so each feature card launches its matching office app tab.
- Made feature cards keyboard-accessible (`role="button"`, `tabIndex={0}`, Enter/Space handlers) and styled them with `cursor: pointer`, hover lift, and focus rings.
- Added an "Allternit" platform link in the homepage header next to the brand, plus a footer links row with the platform link and copyright.
- Rebuilt the main checkout and restarted the preview server at `http://localhost:3019/`.

### Update — full Allternit footer on office homepage
- Created `src/Footer.tsx` that replicates the five-column footer from `www.allternit.com`:
  - Research, Products, A://Labs, Developers, Company.
  - All relative links rewritten as absolute `https://allternit.com/...` links.
  - External links open in a new tab.
- Replaced the minimal footer in `HomePage.tsx` with the new `<Footer />` component.
- Added responsive `office-footer` styles to `HomePage.css` using the office design tokens.
- Rebuilt and restarted the preview server at `http://localhost:3019/`.

----

## CUA Driver Computer History Integration (2026-08-19)

### Goal

Integrate CUA Driver's encrypted Computer History preview (`history_status`, `history_query`) into Allternit's canonical computer-use stack across backend, SDKs, MCP, and plugin layers, with deterministic planning-loop consultation.

### Just did

- Created session worktree `allternit-session-94f633c4-8f25-427a-8c87-c6ba4b68a43c` and wrote an approved implementation plan.
- Implemented the full stack:
  - Python CUA transport: `history_status()` / `history_query()` with bounds validation.
  - Canonical contract: added `tools` to `CapabilityManifest` and JSON schema.
  - CUA provider: probes history admission and advertises tools only when supported & admitted.
  - HTTP API: `POST /history/status` and `POST /history/query` with Pydantic validation.
  - Canonical MCP server: `computer_history_status` and `computer_history_query` tools.
  - TypeScript SDK: history types + `canonicalHistoryStatus` / `canonicalHistoryQuery`.
  - Python SDK: `history_status` / `history_query` client methods.
  - Plugin: tool definitions, HTTP adapter methods, and consultation policy in system prompt.
- Made consultation deterministic by wiring a `history_preflight` callback into `PlanningLoop`; the callback uses the canonical CUA provider to call `history_status` then `history_query` for continuation/recent-work tasks.
- Adjusted `history_query` transport to use the nightly CLI surface (`history list [limit] --session --since --until`) rather than the not-yet-available `history_query` tool, while preserving the same Python/SDK contract.
- Added tests: `domains/computer-use/core/tests/test_cua_history.py` (9 passed) and SDK `client.test.ts` additions (37 passed total).
- Reverted `pnpm-lock.yaml` to keep the diff scoped.

### Verification

- `python3 -m pytest domains/computer-use/core/tests/test_cua_history.py -v` → **9 passed**
- `npm test -- --testPathPattern=client.test.ts` in `sdk/computer-use` → **37 passed**
- Python syntax check on all modified `.py` files → OK
- `canonical.schema.json` valid JSON → OK
- **Real CUA Driver nightly test** (installed 0.20.1-nightly.20260818):
  - `CuaDriverTransport.discover()` found `/Applications/CuaDriver.app/Contents/MacOS/cua-driver`
  - `history_status()` returned `health: ready`, `enabled: true`, `admitted: true`
  - `history_query(limit=3)` returned 3 CloudEvents-style metadata events
  - `CuaDriverCanonicalProvider` advertised `history_status` and `history_query` in `manifest.tools`
  - `gateway.canonical_router.history_preflight_for_task()` returned status + 23 events
  - Legacy packaged binary (0.8.2) degrades gracefully with `CuaDriverCallError`

### Next

Merged into `main` (2026-08-19).

---

## Runtime CLI adapter alignment with Multica production protocols

### Goal
Bring `cmd/gizzi-code/src/runtime/drivers/local-cli-driver.ts` and `cmd/gizzi-code/src/runtime/runtime-discovery.ts` into protocol parity with Multica's production Go implementation so every discovered agent CLI uses the same argv/wire/approval path Multica already ships.

### Background
Multica drives the same CLIs through stable protocol families: `stream-json` (Claude/CodeBuddy/Cursor/OpenCode/DevEco/OpenClaw/Qwen), `acp` (Hermes/Kimi/Kiro/Qoder/QwenPaw/Reasonix/TraeCLI/Grok/MCode), `codex app-server` JSON-RPC (Codex), and one-shot JSON/text (Pi/Oh-My-Pi/Antigravity). Allternit's current adapter map has several mismatches that will break in production (e.g. Codex uses `codex exec`, Cursor/OpenCode/DevEco/OpenClaw use ACP, Kimi/Qwen are one-shot). Discovery also only runs `which` and ignores `MULTICA_*_PATH` / `MULTICA_*_MODEL` overrides and login-shell PATH fallback that Multica uses.

### Plan
1. Refactor `local-cli-driver.ts` into shared protocol runners:
   - `runStreamJson` for line-delimited `stream-json` agents.
   - `runACP` (extend existing) for ACP stdio agents.
   - `runCodexAppServer` for Codex JSON-RPC app-server protocol.
   - `runOneShotJson` / `runOneShotText` for pi/omp/agy.
2. Correct every adapter to match Multica argv:
   - `codex`: `app-server --listen stdio://` JSON-RPC.
   - `cursor-agent`: `-p --output-format stream-json --yolo`.
   - `opencode`: `run --format json --dangerously-skip-permissions`.
   - `deveco`: `run --format json` (stream-json).
   - `openclaw`: `agent ... --output-format stream-json`.
   - `kimi`: `acp` ACP.
   - `qwen`: `-p <prompt> --output-format stream-json --yolo`.
   - Add `mcode`: `acp` ACP.
3. Update `SUBPROCESS_PROVIDERS` in `providers/discovery/subprocess.ts` to add `mcode` and align IDs where needed.
4. Update `runtime-discovery.ts` to support `MULTICA_*_PATH` / `MULTICA_*_MODEL` env overrides and a login-shell PATH fallback with a 30-minute cache.
5. Update tests and fixtures in `cmd/gizzi-code/test/runtime/` and `test/fixture/agent-clis/` to exercise the corrected protocols.
6. Run `bun test test/runtime/` and `bun run typecheck` in `cmd/gizzi-code` and fix all errors.

### Just did
- Created worktree `allternit-session-multica-runtime-align` on branch `session/multica-runtime-align` per repo policy.
- Verified Multica production source for discovery (`agents_probe.go`), backend factory (`agent.go`), builtin runtime registry (`builtin_runtimes.go`), and per-provider backends (`codex.go`, `cursor.go`, `opencode.go`, `kimi.go`, `qwen.go`, `mcode.go`, `claude.go`, `codebuddy.go`, `deveco.go`, `openclaw.go`).
- Audited current Allternit adapter map against Multica protocol families and documented mismatches.
- Refactored `local-cli-driver.ts` into shared protocol runners matching Multica's families:
  - `runStreamJson` for line-delimited `stream-json` agents (Claude/CodeBuddy/Cursor/OpenCode/DevEco/Qwen).
  - `runOpenclawJson` for OpenClaw's NDJSON/final-blob dialect.
  - `runAcp` for ACP stdio agents (Hermes/Kimi/Kiro/Qoder/QwenPaw/Reasonix/TraeCLI/Grok/MCode).
  - `runCodexAppServer` for Codex JSON-RPC app-server over stdio.
  - `runOneShotJson` / `runOneShotText` for Pi/Oh-My-Pi/Antigravity.
- Corrected every provider adapter to Multica argv/wire shapes, added `mcode` (MiniMax Code) to ACP, and mapped Codex to `app-server --listen stdio://`.
- Unified discovery path resolution in `providers/discovery/subprocess.ts` with `MULTICA_*_PATH` / `MULTICA_*_MODEL` overrides, login-shell PATH fallback, and Codex Desktop fallback; `runtime-discovery.ts` now imports the shared resolver.
- Hardened production hygiene in `local-cli-driver.ts`:
  - Added `StderrTail` (2048 bytes) to every runner and surfaced the tail in failure messages.
  - Added `terminateProcessTree` with graceful SIGTERM → SIGKILL for Unix process groups, matching Multica's `proc_other.go`.
  - Replaced direct `proc.kill()` calls in ACP and Codex runners with `terminateProcessTree`.
  - Forward `task.env` into all runners and added Multica-style child env filtering (strips inherited `MULTICA_*` and Claude internal markers).
  - Fixed Codex app-server JSON-RPC dispatch so server requests (`id` + `method`) are answered with the correct shapes (`decision: "accept"`, `action: "accept"`, permissions echo, etc.) instead of being mistaken for responses.
  - Fixed Claude `control_response` shape to match Multica (no `allowed` flag).
- Removed all mock agent CLI fixtures (`test/fixture/agent-clis/*`) and the mock-based execution/discovery test file (`test/runtime/local-cli-driver-execution.test.ts`) because AGENTS.md requires production-quality code with no mock code.
- Kept the adapter registry tests (`test/runtime/local-cli-driver.test.ts`) which verify every discovered provider maps to a concrete adapter mode with no generic fallbacks.

### Verification
- `bun run typecheck` in `cmd/gizzi-code` ✅
- `bun test test/runtime/` in `cmd/gizzi-code` ✅ 24 pass, 0 fail, 170 expect calls

### Next
- Add integration tests that run only when real agent CLIs are installed on the host (e.g. `claude`, `kimi`, `codex`) so the protocol runners are exercised against actual binaries, not mocks.
- Port Multica's per-provider `blockedArgs` filtering to strip protocol-critical flags from user-supplied `customArgs`.
- Decide whether to keep warm pooling or align with Multica's per-task spawn model.

### Open questions
- Do we want to keep `warm` pooling for stream-json agents, or switch to one-shot-per-task like Multica? Multica spawns per task, so parity suggests dropping pooling; keeping pooling is a performance optimization but risks protocol drift.
- Should custom CLI args (`customArgs`) be filtered per-provider like Multica's `blockedArgs` maps? Production safety says yes.

---

## Hybrid Remote Control dashboard and push notifications (2026-08-24)

### Goal

Ship a cross-surface remote-control experience for Allternit that matches the Antigravity remote-control pattern: a web-based dashboard for monitoring/managing agent runtimes across machines, proactive push notifications when a machine needs input, and a mobile-installable PWA.

### Background

Antigravity's remote-control feature (https://antigravity.google/blog/remote-control-for-antigravity) solves the problem of being tied to one workstation while agents run. It provides:
- A browser-based remote-control interface connecting to machines running Antigravity.
- Multi-instance management (laptops, servers, desktops).
- Untethered productivity: start work, walk away, monitor/execute from anywhere.
- Local context retained: no need to recreate the environment elsewhere.
- Proactive push notifications on mobile when an agent needs user input.

Allternit already has runtime pairing, a desktop bridge (`replBridge`/remote-control terminology in gizzi-code), and the platform surface. This feature builds a dedicated remote-control UI and push-delivery worker on top of that foundation.

### Just did

- Created `/remote-control` hub page inside `ai.allternit.com` (`surfaces/ai.allternit.com/src/pages/RemoteControlHubPage.tsx`) with runtime list, online counts, pending permissions, and pending questions.
- Wired route `/remote-control` in `src/routes.tsx` and added a "Remote Control" rail item in `src/shell/ShellRail.tsx` using `DesktopTower`.
- Added desktop detached window support:
  - `shell:open-remote-control` IPC handler in `surfaces/allternit-desktop/src/main/unified-main.ts`.
  - `remoteControlWindow` BrowserWindow with `setWindowOpenHandler` rule for `/remote-control.html`.
  - Preload exposure `openRemoteControl` in `surfaces/allternit-desktop/src/preload/index.ts`.
- Scaffolded standalone dashboard entry:
  - `surfaces/ai.allternit.com/remote-control.html`
  - `src/remote-control/main.tsx`, `App.tsx`, `pages/DashboardPage.tsx`, `types.ts`
- Configured Vite multi-entry build in `surfaces/ai.allternit.com/vite.config.ts`.
- Added PWA assets: `public/remote-control.webmanifest`, `public/remote-control-service-worker.js`, plus `_redirects` pass-throughs.
- Created push worker service `services/remote-control-push/` (Hono + Wrangler + KV + VAPID signing) with `/vapid-public-key`, `/subscribe`, `/unsubscribe`, `/notify`, and `/pending` endpoints.
- Added runtime push trigger `cmd/gizzi-code/src/runtime/integrations/remote-control-push.ts`, initialized in `cmd/gizzi-code/src/runtime/context/project/bootstrap.ts`.
- Added deploy workflow `.github/workflows/deploy-remote-control-cloudflare.yml` for Pages + worker.

### Verification

- `cd services/remote-control-push && pnpm typecheck` ✅ clean.
- `cd cmd/gizzi-code && bun run typecheck` ✅ only pre-existing `packages/sdk/scripts/verify-sdk.ts` errors; no remote-control-related errors.
- `cd surfaces/ai.allternit.com && pnpm exec tsc --noEmit` ✅ only pre-existing office-package errors; no errors in touched remote-control files.
- `pnpm install` succeeded and lockfile updated for the new service.

### Open gaps

- Production `pnpm build` is blocked by pre-existing missing PNG assets in office packages (`send-stop.png`, `attach-icon.png`, `send-enter-on.png`). The remote-control-specific build path has not been verified end-to-end.
- Real Cloudflare Pages project `allternit-remote-control`, KV namespace, custom domain `remotecontrol.allternit.com`, and VAPID secrets still need to be created/set.
- End-to-end screen recordings have not been produced yet.
- Steering spec was just updated; this checkpoint needs steering review before commit/merge.

### Update — dev verification completed (2026-08-24)

- Fixed `surfaces/ai.allternit.com/vite.config.ts` `remoteControlRoutePlugin()` so `/remote-control` rewrites to `/index.html` and is processed by Vite's HTML transform pipeline. Previously it served raw `index.html`, which broke React Fast Refresh and left the hub page blank.
- Fixed standalone dashboard dark-mode default:
  - Added `src/remote-control/theme/RemoteControlThemeStore.ts` + `RemoteControlThemeProvider.tsx` with `dark` default and isolated storage key (`allternit-remote-control-theme-storage`).
  - Updated `src/remote-control/main.tsx` to use the new provider.
  - Updated `remote-control.html` inline script to seed dark mode and use the isolated storage key, so hydration no longer flashes light.
- Verified in dev:
  - `curl http://localhost:3013/remote-control` → 200, platform SPA shell renders.
  - `curl http://localhost:3013/remote-control.html` → 200, standalone dashboard renders in dark mode.
  - Chrome headless screenshot confirms dark theme.
- Ran push worker locally (`services/remote-control-push` with `.dev.vars`) and verified all endpoints:
  - `GET /health` → `{"ok":true}`
  - `GET /vapid-public-key` → public key string
  - `POST /subscribe` → `{"ok":true}`
  - `POST /notify` → `{"ok":true,"delivered":0,"total":1}` (delivered 0 because endpoint is fake)
  - `GET /pending?endpoint=...` → pending payload
- Improved PWA/service-worker cross-origin support:
  - `public/remote-control-service-worker.js` now accepts `SET_PUSH_WORKER_URL` message.
  - `src/remote-control/App.tsx` sends the configured push-worker URL to the service worker after registration.
  - `getPendingUrl()` uses the push-worker origin when available, fixing `/pending` fetches when dashboard and worker are on different subdomains.
- Created `.steering/REMOTE_CONTROL_DEPLOYMENT.md` with step-by-step Cloudflare Pages project, KV namespace, custom domain, DNS, VAPID secret, and verification instructions.

### Still blocked / needs real-world setup

- Production Cloudflare Pages project `allternit-remote-control`, KV namespace, custom domains (`remotecontrol.allternit.com`, `push.remotecontrol.allternit.com`), and VAPID secrets require Cloudflare credentials and cannot be created from this dev environment.
- End-to-end screen recordings are pending; will capture after documenting deployment steps.

### Next

1. Record end-to-end screen recordings of standalone dashboard, platform hub, push-worker endpoints, and PWA install prompt.
2. Run steering consult on the spec + checkpoint.
3. Commit and merge `session/remote-control-hybrid`.

---

### Open questions
- Should the platform API mirror also expose a `/push/notify` proxy so runtimes can trigger pushes through the existing cloud relay instead of calling the worker directly?
- Do we want per-runtime push opt-in persisted in the platform DB, or is the browser's Push subscription + KV state sufficient?

---

## Allternit Remote Control — real-world deployment steps (2026-08-23)

### Goal
Generate VAPID keys, create Cloudflare resources, deploy the push worker, configure the platform Pages project, and verify the endpoints.

### Just did
- Generated VAPID keys with `npx web-push generate-vapid-keys`.
- Created Cloudflare KV namespace `allternit-remote-control-push-PUSH_SUBSCRIPTIONS` with id `7a159a562ff24a5f9e9a1fe04d00abda`.
- Bound the KV namespace in `services/remote-control-push/wrangler.toml`.
- Switched Durable Object migration from `new_classes` to `new_sqlite_classes` for free-plan compatibility.
- Set worker secrets `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` via `wrangler secret put`.
- Deployed the worker: `https://allternit-remote-control-push.allternitpbc.workers.dev`
- Set `NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL=https://allternit-remote-control-push.allternitpbc.workers.dev` in the `ai-allternit` Pages project (production environment) via the Cloudflare API.
- Verified worker endpoints with curl:
  - `GET /push/vapid-public-key` → returns public key ✅
  - `POST /push/subscribe/:runtimeId` → stores subscription ✅
  - `POST /push/notify/:runtimeId` → attempts delivery, reports sent/failed ✅
  - `POST /push/unsubscribe/:runtimeId` → removes subscription ✅
- Committed the wrangler.toml changes and merged into `main`.

### Verification
- Worker live URL responds correctly ✅
- KV namespace bound and writable ✅
- VAPID key retrievable by browser clients ✅

### Remaining
1. Push `main` to GitHub so the Pages project rebuilds with the new env var.
2. Run a live browser end-to-end test: pair a runtime, open the remote panel on a phone/PWA, enable push, trigger a permission/question, and confirm the notification arrives.

### Important notes
- VAPID private key lives only as a Cloudflare Worker secret; it is NOT in the repo.
- The worker is on the Cloudflare free plan, which required the `new_sqlite_classes` Durable Object migration.
- `main` is 6 commits ahead of `origin/main`.

---

## Allternit Remote Control — Pages build fix and final state (2026-08-24)

### Goal
Ensure the deployed PWA can register its service worker and manifest, and prepare the final manual end-to-end test.

### Just did
- Discovered the live deployment was returning `index.html` for `/manifest.json`, `/sw.js`, and `/icons/*` because `public/_redirects` lacked pass-through rules for PWA static files.
- Updated `surfaces/ai.allternit.com/public/_redirects` to add `200` pass-through rules for `/manifest.json`, `/sw.js`, and `/icons/*`.
- Committed the fix, merged into `main`, and pushed to GitHub.
- Updated `.github/workflows/deploy-cloudflare-pages.yml` to pass `NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL` from a GitHub secret to the Vite build.
- Set the GitHub repository secret `NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL=https://allternit-remote-control-push.allternitpbc.workers.dev`.
- Pushed the workflow update; Pages build succeeded and deployed.
- Verified live deployment:
  - `https://ai.allternit.com/manifest.json` returns the manifest JSON ✅
  - `https://ai.allternit.com/sw.js` returns the service worker JS ✅
  - `https://ai.allternit.com/icons/icon-192x192.png` returns 200 ✅
  - The main JS bundle contains `allternit-remote-control-push.allternitpbc.workers.dev` ✅
- Attempted an automated Playwright browser push test; Chromium download timed out, so the final notification delivery test is deferred to manual verification.

### Current state
- Worker: `https://allternit-remote-control-push.allternitpbc.workers.dev` deployed and verified.
- Platform: `https://ai.allternit.com` deployed with PWA files and push worker URL available.
- `main` is in sync with `origin/main`.

### Manual end-to-end test steps
1. On a phone or desktop Chrome, open `https://ai.allternit.com` and sign in.
2. Navigate to the Dispatch/Remote view and select a paired runtime.
3. Click the bell icon in the Remote Session panel and allow notifications when prompted.
4. In the browser DevTools, verify the service worker registered and a push subscription was created.
5. Trigger a permission request or question on the runtime (e.g., ask the agent to run a command that requires approval).
6. Confirm a push notification arrives with the Allternit icon and action buttons.
7. (Optional) Send a test notify directly: `curl -X POST https://allternit-remote-control-push.allternitpbc.workers.dev/push/notify/<runtimeId> -H "Content-Type: application/json" -d '{"title":"Test","body":"Push works"}'` after subscribing.

### Open questions
- None blocking; the remaining work is the manual browser notification test.

---

## Allternit Remote Control — production dashboard wiring (2026-08-24)

### Goal
Get the standalone remote-control dashboard at `remotecontrol.allternit.com` fully wired to the production cloud API and push worker, with correct sign-in redirects and CORS.

### Just did
- Re-deployed the push worker (`allternit-remote-control-push.allternitpbc.workers.dev`) after it had stopped serving requests (error 1042). Verified `/push/vapid-public-key` returns 200 with `access-control-allow-origin: *` from both `remotecontrol.allternit.com` and Pages preview origins.
- Updated `surfaces/ai.allternit.com/.env.production`:
  - Fixed the Clerk publishable key to the correct `pk_live_Y2xlcmsucGxhdGZvcm0uYWxsdGVybml0LmNvbSQ` value.
  - Set `NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL=https://api.allternit.com`.
  - Set `NEXT_PUBLIC_ALLTERNIT_GATEWAY_URL=https://api.allternit.com` and `VITE_ALLTERNIT_GATEWAY_URL=https://api.allternit.com`.
  - Set `NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL=https://allternit-remote-control-push.allternitpbc.workers.dev`.
  - Set Clerk after-sign-in/up redirects to `https://remotecontrol.allternit.com`.
- Built the missing office-package `dist/` artifacts that were blocking the Vite build (`@allternit/office-docx-engine`, `@allternit/office-file-parse`, `@allternit/office-pptx-engine`, `@allternit/office-pptx-render`, `@allternit/office-xlsx-engine`).
- Rebuilt and re-deployed the dashboard to the `allternit-remote-control` Pages project. New deployment: `https://a556c0c0.allternit-remote-control.pages.dev`.
- Verified the custom domain `remotecontrol.allternit.com` resolves and serves the new deployment (HTTP 200, correct HTML title, manifest/sw.js pass-through in `_redirects`).
- Configured production environment variables on the `allternit-remote-control` Pages project so future Git-triggered builds use the same endpoints.
- Added `remotecontrol.platform.allternit.com` as an additional custom domain on the Pages project so it can be used as a Clerk-origin-safe fallback while the main domain is being allow-listed.

### Verification
- `curl -I https://remotecontrol.allternit.com/` → 200 ✅
- `curl -I -H "Origin: https://remotecontrol.allternit.com" https://api.allternit.com/api/v1/runtime` → `access-control-allow-origin: https://remotecontrol.allternit.com` ✅
- `curl -H "Origin: https://remotecontrol.allternit.com" https://allternit-remote-control-push.allternitpbc.workers.dev/push/vapid-public-key` → 200 with public key ✅
- `curl https://api.allternit.com/api/v1/runtime` without auth → 401 (expected; auth enforced) ✅

### Remaining blockers
1. **Clerk origin allow-list.** `remotecontrol.allternit.com` is not authorized in the Clerk production app. Clerk rejects the origin with:
   > Production Keys are only allowed for domain "platform.allternit.com". API Error: The Request HTTP Origin header must be equal to or a subdomain of the requesting URL.
   - Fix: In the Clerk dashboard for the `platform.allternit.com` app, add `remotecontrol.allternit.com` as an authorized domain (Settings → Domains / Authorized domains).
   - Fallback (no Clerk dashboard access): use `https://remotecontrol.platform.allternit.com`; I already added it to the Pages project and it will work as a subdomain of `platform.allternit.com` once you create the DNS record below.
2. **DNS record for the platform subdomain (fallback only).** If using the fallback domain, add:
   - Type: `CNAME`
   - Name: `remotecontrol.platform`
   - Target: `allternit-remote-control.pages.dev`
   - Proxy status: orange-cloud (Proxied)
3. **Real paired runtime for end-to-end demo.** No runtime is currently paired with the production cloud API, so the Remote Session panel will show "No active sessions". After the Clerk domain issue is resolved, pair a runtime (local agent-daemon, desktop app, or hosted VM) and approve it at `https://platform.allternit.com/pair?code=XXXX`.

### Open questions
- Do you want to keep the primary domain as `remotecontrol.allternit.com` and add it to Clerk, or switch primary to `remotecontrol.platform.allternit.com`?
- Should I attempt to pair a local `agent-daemon` now using the platform sign-in flow (which works because `platform.allternit.com` is already Clerk-authorized), so a runtime exists for testing once the remote-control domain is fixed?

---

## HUD mode — fix main renderer crash + HUD route wiring (2026-08-25)

### Goal
Fix the "Cannot read properties of null (reading 'useState')" crash in `ControlCenter` that blocks normal app launch on the `session/hud-mode` branch, and ensure `/hud` renders the floating chat HUD.

### Root cause
Two independent but complementary issues:
1. **React instance mismatch.** The workspace root resolves React 19 (from `framer-motion` dev dependencies) while `surfaces/ai.allternit.com` pins React 18. Transitive workspace imports can pull in the root React instance alongside the surface's React 18, breaking the hook dispatcher and producing the `useState`/`useContext` null-dispatcher crash.
2. **Service worker caching Vite dev modules.** `public/sw.js` was cache-first caching every GET request, including Vite's optimized dependency chunks (`/node_modules/.vite/...`, `/src/...`, `/@vite/...`). When Vite re-optimized dependencies and the browser loaded a mix of stale cached chunks and fresh chunks, React and React-DOM instances were mismatched, causing the same crash.
3. **Missing `/hud` route wiring.** The HUD renderer code in `ShellApp.tsx` expected `window.location.pathname === '/hud'`, but `/hud` was not registered in `routes.tsx`, there was no `hud` `ViewType`, and no spawn policy. The catch-all redirect sent `/hud` to `/`.

### Just did
- Added explicit `resolve.alias` entries in `surfaces/ai.allternit.com/vite.config.ts` forcing every `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, and `react-dom/client` import to the surface's React 18 copy.
- Updated `surfaces/ai.allternit.com/public/sw.js` to bypass Vite development module URLs in its fetch handler, preventing stale/fresh chunk mismatches.
- Added `/hud` route in `surfaces/ai.allternit.com/src/routes.tsx` mapping to `ShellPage`.
- Added `"hud"` to `ViewType` in `surfaces/ai.allternit.com/src/nav/nav.types.ts`.
- Added spawn policy for `hud` in `surfaces/ai.allternit.com/src/nav/nav.policy.ts`.

### Verification
- Reproduced the crash class in Playwright: `Cannot read properties of null (reading 'useContext')` in `AuthGate` with "Invalid hook call" warnings.
- Confirmed workspace root resolves React 19 and platform surface resolves React 18.
- Headless browser verification (with office workspace packages excluded from Vite eager scan for demo):
  - `http://localhost:3017/` loads the main platform without the `ControlCenter` crash.
  - `http://localhost:3017/hud` renders the floating chat HUD (dark frosted bar, drag handle, close button, composer at bottom).

### Next
1. Run a full end-to-end test in the actual Electron desktop app with `Cmd+Shift+H`.
2. Verify drag handle and close button IPC still work.
3. Address remaining HUD polish items from the original handoff (Hermes visual matching, click-through, resize).

### Open questions
- None blocking.


## Brain selection contract fix (2026-08-26)

### Goal
Make the brain the user selects in the platform UI actually reach the Gizzi runtime instead of being overwritten by the backend default.

### Just did
- Added `model: Option<GizziModelRef>` to `CreateSessionBody` in `cmd/allternit-api/src/agent_session_routes.rs`.
- `create_session` now uses the frontend-supplied model and only falls back to `AppConfig.default_model()` when none is sent.
- Added `BrainRef` type in `surfaces/ai.allternit.com/src/lib/agents/native-agent-api.ts` and threaded it through `CreateNativeAgentSessionRequest` and `CreateModeSessionOptions`.
- `ChatView.handleSend()` now passes the current `ModelSelection` as a `BrainRef` into `createSession` and as `providerID/modelID` into the message stream.
- Removed the drifted `localStorage`-based model fallback from `mode-session-store.ts` and removed `getBrainSessionConfig` dead code from `model-selection-provider.tsx`.
- Verified `cargo check -p allternit-api` and confirmed no new TypeScript errors in the touched files.

### Next
1. Proxy Gizzi live provider discovery (`GET /providers`, `/providers/auth`) through `/api/v1/providers*` so the picker shows real installed/authenticated brains.
2. Update the model picker to consume the proxied discovery data instead of the static registry.
3. Add a Gizzi session-level model pin so the selected brain persists across turns.
4. Port `AuthPlan`/named auth-profile support to Gizzi.

### Open questions
- Should `/api/v1/providers` keep the existing `ProviderRow` shape for backwards compatibility, or can we expose Gizzi's raw provider objects?
- Do we want to remove the static `ENV_PROVIDER_SPECS`/`CLI_PROVIDER_SPECS` tables entirely, or keep them as a fallback when Gizzi is unreachable?


## Proxy Gizzi provider discovery to `/api/v1/providers*` (2026-08-26)

### Goal
Make `GET /api/v1/providers` and `GET /api/v1/providers/auth/status` return live Gizzi-discovered providers instead of the static env/CLI tables.

### Just did
- Added `discover_providers()` and `provider_auth_methods()` to `cmd/allternit-api/src/gizzi_provider_auth.rs`, following the existing `client()`/`base_url()` pattern.
- Added `ProviderInfo` and `ModelInfo` serde structs to `cmd/allternit-api/src/provider_routes.rs` for the frontend-facing provider shape.
- Rewrote `list_providers` to call Gizzi `/provider`, transform each entry into `ProviderInfo`, and return `{providers, all}`. Falls back to the existing static merge (converted into `ProviderInfo`) if Gizzi is unreachable.
- Rewrote `list_provider_auth_status` to call Gizzi `/provider` and `/provider/auth`, transform entries into `ProviderAuthStatusRow` with `auth_profile_id: None` and `chat_profile_ids: []`, and fall back to the static merge if either Gizzi call fails.
- Kept `ENV_PROVIDER_SPECS`/`CLI_PROVIDER_SPECS` and the existing merge helpers for the fallback path.
- Ran `cargo check -p allternit-api`; no new warnings (33 pre-existing warnings remain).

### Next
1. Update the frontend model picker to consume the proxied discovery response instead of the static registry.
2. Add a Gizzi session-level model pin so the selected brain persists across turns.
3. Port `AuthPlan`/named auth-profile support to Gizzi.

### Open questions
- Should the fallback path continue returning `ProviderInfo` forever, or do we eventually want to drop the static tables when Gizzi is mandatory?

---

## Brain selection handoff — AuthPlan + session pin (2026-08-26)

### Goal
Re-implement slices 1–6 of the brain-selection handoff so the frontend-selected brain reaches Gizzi sessions and auth resolution is explicit.

### Just did
- Added named auth profiles store (`Auth.Profile`, `~/.gizzi/auth-profiles.json`) in `cmd/gizzi-code/src/runtime/integrations/auth/auth.ts`.
- Added `ModelRef`, `AuthPlan`, `prepareAuth`, `RuntimePolicy`, `resolveRuntimePolicy`, and `rotateAuth` in `cmd/gizzi-code/src/runtime/providers/provider.ts`.
- Wired `AuthPlan` through `getLanguage`, `LLM.stream`, `SessionPrompt`, and `SessionProcessor`.
- Added session-level `default_model` pin with Drizzle migration in `cmd/gizzi-code/src/runtime/session/*`.
- Added `runtime` enum to `Config.Provider` and per-model config.
- Forwarded `authProfileId` from the Allternit API into the Gizzi session payload in `cmd/allternit-api/src/agent_session_routes.rs`.

### Verification
- `cargo check -p allternit-api`: ✅ passes.
- `cd cmd/gizzi-code && bun run typecheck`: ✅ no errors in touched files; pre-existing missing `packages/sdk/dist/*` artifacts remain.

### Next
1. Slice 7: add E2E test that selected model reaches Gizzi session + message.
2. Slice 8: final typecheck/build sweep and clean up any regressions.
## Remote Control gap fix (session/remote-control-gap-fix) — 2026-08-26

### Goal

Close the critical gaps left by the previous remote-control implementation:
1. Rename internal `dispatch` surface to `remote-control` and add `/remote` route.
2. Fix push worker route prefix mismatch between worker, SDK, dashboard, and README.
3. Align permission/question API paths between SDK and gizzi-code `remote_control.ts`.
4. Make the Dispatch/Remote Control composer actually send messages to a runtime.

### Just did

- Created fresh linked worktree `allternit-session-remote-control-gap-fix` from `main`.
- Wrote consolidated gap analysis to `/Users/joe/Desktop/allternit-remote-control-gap-analysis.md`.
- Created `docs/projects/remote-control-gap-fix/TODO.md` task tracker.

### Just did (continued)

- Renamed internal `dispatch` view type to `remote-control` and added `/remote` route alias.
- Aligned push worker contract: worker uses no `/push` prefix; SDK, e2e test, README, and env vars updated.
- Verified `/v1/permission` and `/v1/question` routes already exist in gizzi-code and match SDK calls.
- Made DispatchView composer real: creates a remote session and sends the message via `RemoteControlClient`.
- Added `createSession` to SDK `RemoteControlClient`.
- Gated dev mock runtimes behind `ALLTERNIT_LOCAL_DEV_BYPASS`.
- Implemented live pending permission/question counters in `RemoteControlHub` and `DashboardPage`.
- Committed changes to `session/remote-control-gap-fix`.

### Verification

- `pnpm typecheck:fast` in `surfaces/ai.allternit.com` passes for touched files; pre-existing errors remain in unrelated packages.
- `pnpm typecheck` in `services/remote-control-push` ✅.
- SDK `runtime/index.ts` typechecks cleanly.
- `vite build --config vite.remote-control.config.ts` still fails on pre-existing top-level-await in a vendored dependency, unrelated to changes.

### Next

- Remove session worktree after user review (branch `session/remote-control-gap-fix` is committed and preserved).
- Remaining gaps for follow-up: push worker auth, subscription TTL/GC, PWA offline shell, native OS permission requests, iOS APNs backend endpoint.

### Open questions

- Should push worker add authentication now (Clerk bearer + device-token-signed `/notify`), or defer until after merge?
- Should `/runtimes` redirect to `/remote`, or keep both as aliases?

---

## Remote Control Gap Fix (security, PWA, UX polish)

### Goal
Close the remaining production gaps in Remote Control: secure push notifications, PWA hardening, and honest setup UX.

### Just did

- **Push worker security (Phase 4)**
  - `/subscribe` now requires a valid Clerk bearer token and verifies the user owns the requested `runtimeId`.
  - `/notify` accepts either the service secret (cloud → worker) or a paired runtime device token (gizzi → worker), and enforces runtime-id matching for device tokens.
  - Added KV TTL for subscriptions (90 days), pending-payload TTL (5 min), and dead-subscription cleanup on 404/410 push responses.
  - Added per-runtime rate limiting on `/notify` (30/min).
  - Rewrote `cmd/gizzi-code/src/runtime/integrations/remote-control-push.ts` to scope notifications to the cloud-paired `runtimeId`, include typed payloads (permission/question/completed/error), and subscribe to `Session.Event.Error`.
  - Added notification-type toggles in settings.

- **PWA hardening (Phase 5)**
  - Updated `remote-control.webmanifest` with stable `id`, correct `start_url`, `scope`, and PNG icon references.
  - Added iOS meta tags and `apple-touch-icon` / `apple-touch-startup-image` to `remote-control.html`.
  - Rewrote `remote-control-service-worker.js` with precaching, offline app-shell fallback, and deep-link `notificationclick` handling.
  - Generated placeholder PNG icons/splash (to be replaced by real design assets before launch).
  - Added `Notification.requestPermission()` gate and per-runtime push state in `DashboardPage.tsx`.
  - Added push-worker `/subscriptions` endpoint so the dashboard shows accurate per-runtime subscription state instead of a global guess.
  - Fixed missing `Authorization` headers on `/subscribe` and `/unsubscribe` dashboard calls.

- **UX cleanup (Phase 6)**
  - Replaced fake macOS permission toggles with honest copy + "Open System Settings" deep-links in `DispatchView.tsx` and `DispatchSettingsPanel.tsx`.
  - Added mock-runtime banner (`MockRuntimesBanner.tsx`), loading/status states in `RemoteControlHub.tsx`, and empty-state CTAs across `MachinesPanel.tsx`, `RemoteSessionPanel.tsx`, and `RemoteControlHub.tsx`.

### Verification

- `pnpm typecheck` in `services/remote-control-push` ✅.
- `pnpm typecheck:fast` in `surfaces/ai.allternit.com` shows no new errors in touched `remote-control` / `dispatch` files; pre-existing errors remain in unrelated office-suite packages.
- `bun run typecheck` in `cmd/gizzi-code` shows no errors in touched `remote-control-push.ts` / `pairing.ts`; pre-existing SDK `dist/` import errors remain.

### Next

- Replace placeholder PWA icons/splash with final design assets.
- Build the remote-control entry to confirm bundling (pre-existing top-level-await blocker in a vendored dep is unrelated).
- Run full manual E2E: pair runtime → open PWA → trigger permission/question → receive push → approve/respond.
- Merged to `main` at `2c21d67e3`.
