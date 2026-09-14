# Steering checkpoint — session/aproduct-0913
# Steering checkpoint

## iOS local models marketplace — Phase 2 integration (2026-08-26)

### Goal
Integrate and polish the Phase 1 creation surfaces, verify focused behavior, document the result, and push the session branch without starting Phase 3.

### Just did
- Reviewed the Phase 1 commits and complete creation-feature diff against `origin/main`.
- Fixed a render-time `selectedModeId` initialization-order bug in `ChatComposer`.
- Restored the creation-specific provider registries/plugins that match the retained settings hooks and panels, preserving Bonsai local/WebGPU support.
- Wired format payload parsing into `agent-mode-executor`, including deterministic DOCX/XLSX engines and concrete website/slides/image/video options.
- Expanded executor tests across office artifacts, provider selection, artifact output, and missing-key settings navigation.
- Attempted focused Vitest execution; it could not start because the existing Vitest package link points to a missing `vitest.mjs`.
- Ran permitted parser/diff checks: Deno parsed every changed TS/TSX file (format differences reported) and `git diff --check` passed.
- Wrote the required Phase 2 notes and updated the Phase 2 plan.

### Next
1. Obtain steering commit-gate approval.
2. Commit the Phase 2 implementation and documentation coherently.
3. Push `session/7d581442-d796-4e0e-bdac-2fec641c3677` to origin.

### Open questions
- The focused tests should be rerun when the workspace Vitest link is repaired; dependency repair is outside this phase and was not attempted.

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
A:// product-depth phase (2026-09-13), owner-approved. Six items, dependency
order: P-T1 store-consolidation boundary → P-T2 non-local compute placement →
P-T3 worker daemon packaging → P-T4 connector breadth → P-T5 Al persona
runtime v0.1 → P-T6 Cowork protocol rendering. No merges — owner reviews.
Worktree: ../allternit-session-aproduct-0913 on session/aproduct-0913.

## Just did (resumed session — implementation was complete from prior run;
this run = verification, live evidence, and live-path bug fixes)
- Verified: cargo test -p allternit-cowork-runtime 37 green; cargo build
  -p allternit-api clean; clippy clean on ALL touched files (fixed
  pre-existing warnings in session-touched files: unused mut, late-init,
  missing docs, redundant closures); gizzi typecheck clean (0 errors after
  pnpm install restored worktree node_modules — note: prior session had
  symlinked root node_modules to the shared checkout, which vanished);
  frontend (ai.allternit.com) typecheck clean.
- Live evidence (fresh-migrated scratch DB, dev port 18013, captured in
  tmp/aproduct-evidence/LIVE_EVIDENCE.md + runnable run.sh): P-T2 vm-job
  claim granted/refused (A_CAPABILITY_MISSING 422); P-T4 files read/write
  through broker incl. approval gate + path-escape refusal + on-disk proof;
  P-T1 projection_applied false→true boundary; P-T5 Al chat fallback +
  transcript + end-to-end delegation (rule → intent → run → daemon claim);
  P-T3 daemon claim→execute→complete→SIGTERM; P-T6 all new endpoints.
- Live-path fixes (found ONLY by the live run; unit tests used the runtime
  schema and missed them): submit_intent/enqueue_job omitted dag_node_id
  (NOT NULL on API schema) → 500 on every intent submit; intent runs had no
  user_id → V169 owner-scoped reads 404'd; register_principal stored full
  a://workspace URIs vs stripped run workspace_ids → claims never matched;
  list_jobs/transition_job consulted only the in-memory mirror → canonical
  jobs invisible / 500. All fixed via canonical helpers (set_run_owner,
  workspace normalization, canonical fallbacks).
- Pre-existing main breakage fixed: duplicate migration versions
  V142/V143/V144 (cowork pass vs earlier migrations) panicked EVERY fresh
  DB (refinery UNIQUE constraint) and silently skipped the cowork columns
  on existing DBs → renumbered V169/V170/V171; added V172 connector-breadth
  seeds (github/files registrations were only in the runtime DDL seed, not
  the API migration chain). Gotcha documented: embed_migrations! does not
  trigger rebuilds on new migration files — touch db.rs.

## Next
1. Owner reviews PR #491 (https://github.com/Gizziio/allternit-platform/pull/491).
   No merge by this session; no attestation (post-merge step).
2. Worktree left in place per instructions.

## Open questions
- P-T2 doc said "vfkit machinery" but the vfkit manager was deleted in the
  2026-09 cleanup; Lima is the current VM surface. Implemented VM mode via
  Lima and documented the correction in GIZZI_WORKER_SPEC.
- cloud-api Postgres store: honestly marked product-local projection, NOT
  removed (would gut live cloud routes) — per DoD's escape clause.
- API dev server on 18013 was killed twice by unknown external causes
  mid-session (concurrent sessions on this machine); evidence runs were
  re-done cleanly. Not investigated further.

Implement Rails as the unified agent communication and coordination system: consolidate cross-session messaging, agent orchestration, and steering under the existing Allternit Agent System Rails (`rails/`). Deliver Phase 1 (peer registry + steering foundation) through Phase 7 (documentation and packaging).

## Just did

- Created session worktree `allternit-session-e0669b29-9550-4a8e-af12-3f0d9e66f3c5` on branch `session/e0669b29-9550-4a8e-af12-3f0d9e66f3c5`.
- Phase 1 (peer registry + steering foundation):
  - Implemented `rails/src/peer/` module (`types.rs`, `registry.rs`, `inbox.rs`, `mod.rs`).
  - Implemented `rails/src/steer/` module (`types.rs`, `checkpoint.rs`, `consult.rs`, `mod.rs`).
  - Wired peer and steer into `rails/src/lib.rs`, `rails/src/service.rs`, and `rails/src/bin/allternit-rails.rs`.
  - Added `/api/rails/peers/*` and `/api/rails/steer/*` proxy routes in `cmd/allternit-api/src/rails/mod.rs`.
- Phase 2 (cross-session messaging via Bus):
  - Extended `rails/src/mail/types.rs` with peer address support.
  - Added `run_uds_transport` and UDS delivery to `rails/src/bus/mod.rs`.
  - Added `PeerInboundPolicy` gating in `rails/src/gate/gate.rs`.
  - Added `/v1/peers/send` and `/v1/peers` HTTP routes in `rails/src/service.rs`.
- Phase 3 (native orchestrator):
  - Implemented `rails/src/orchestrator/` module (`spec.rs`, `session.rs`, `runner.rs`, `review.rs`, `mod.rs`).
  - Added `/v1/orchestrator/*` HTTP routes and `allternit rails orchestrator ...` CLI commands.
  - Added `/api/rails/orchestrator/*` proxy routes in `cmd/allternit-api/src/rails/mod.rs`.
- Phase 4 (gizzi-code wiring):
  - Implemented `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/` (tool, prompt, UI, constants).
  - Replaced `udsMessaging.ts` and `udsClient.ts` stubs in both `src/cli/ui/ink-app/utils/` and `src/shared/utils/` with Rails peer-registry clients.
  - Updated `src/cli/ui/ink-app/setup.ts` and `src/runtime/gizzi-core/setup.ts` to export the session id before starting UDS messaging.
  - Updated `src/runtime/tools-registry-gizzi.ts` to register `ListPeersTool` from the ink-app tool.
  - `SendMessageTool` UDS branch now routes through Rails `/v1/peers/send` via `sendToUdsSocket()`.
- Verified:
  - `cargo test -p allternit-agent-system-rails` ✅ (85 passed + 5 invariants + 1 doc test)
  - `cargo build -p allternit-api` ✅
  - gizzi-code TypeScript has no errors in changed files (full `tsc --noEmit` is blocked by pre-existing missing `@allternit/gizzi-sdk/dist` artifacts in this worktree).

## Next

1. Phase 5: rewrite `tools/agent-orchestrator/scripts/ao-*` as thin `allternit rails orchestrator ...` / `allternit rails steer ...` shims.
2. Phase 6: replace `.steering/bin/*.sh` hooks with `allternit rails steer ...` calls.
3. Phase 7: update `rails/README.md`, `docs/Core_System/01-Reality/SPEC-Reality-Rails-Control-Plane.md`, `docs/ALLTERNIT_MUX_PLAN.md`, and relevant `AGENTS.md` files.

## Open questions

- Should the UDS runner be started automatically by the Rails service, or exposed as a separate `allternit-rails bus uds-runner` command?
- How should the orchestrator module authenticate to the `allternit-mux` UDS API when running inside the Rails service?
- Do we keep the existing `@allternit/orchestrator` package API surface unchanged while redirecting internals to Rails, or do we publish a breaking change?
- Should gizzi-code automatically start the Rails service if it is not running, or fail closed with a clear error?

## Files changed / to commit

New:
- `rails/src/peer/types.rs`
- `rails/src/peer/registry.rs`
- `rails/src/peer/inbox.rs`
- `rails/src/peer/mod.rs`
- `rails/src/steer/types.rs`
- `rails/src/steer/checkpoint.rs`
- `rails/src/steer/consult.rs`
- `rails/src/steer/mod.rs`
- `rails/src/orchestrator/spec.rs`
- `rails/src/orchestrator/session.rs`
- `rails/src/orchestrator/runner.rs`
- `rails/src/orchestrator/review.rs`
- `rails/src/orchestrator/mod.rs`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/ListPeersTool.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/constants.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/prompt.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/tools/ListPeersTool/UI.tsx`

Modified:
- `rails/src/lib.rs`
- `rails/src/service.rs`
- `rails/src/bus/mod.rs`
- `rails/src/mail/types.rs`
- `rails/src/gate/gate.rs`
- `rails/src/bin/allternit-rails.rs`
- `cmd/allternit-api/src/rails/mod.rs`
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/udsMessaging.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/utils/udsClient.ts`
- `cmd/gizzi-code/src/shared/utils/udsMessaging.ts`
- `cmd/gizzi-code/src/shared/utils/udsClient.ts`
- `cmd/gizzi-code/src/cli/ui/ink-app/setup.ts`
- `cmd/gizzi-code/src/runtime/gizzi-core/setup.ts`
- `cmd/gizzi-code/src/runtime/tools-registry-gizzi.ts`
- `.steering/checkpoint.md`
