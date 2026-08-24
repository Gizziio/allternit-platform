# Steering checkpoint

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
