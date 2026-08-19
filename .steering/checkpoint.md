# Steering checkpoint

## Goal

Purge every `opencode` reference/dependency from `cmd/gizzi-code`, keeping only `opencode` as a model/provider selection identifier, then verify with `bun run typecheck`, `bun run build`, `bun run test`, and `./dist/gizzi-code --help`.

## Just did

- Created linked worktree `allternit-platform-session-opencode-cleanup` on branch `session/opencode-cleanup`.
- Scanned `cmd/gizzi-code` and found 106 files still containing `opencode`.

## Next

- Remove/replace opencode references in scripts, SDKs, infra, source comments, and docs.
- Remove opencode from continuity/handoff parsers and types.
- Update tests to use gizzi/claude/generic identifiers (except model-selection provider IDs).
- Run validation suite and commit.

## Open questions

- None.

---

## Goal

Continue iOS parity sweep: polish the chat composer (glass deck pills, plus-menu parity, bot mode selector) and build remaining platform surfaces on iOS (Site APIs, Code usage, Office/PDF signing).

## Just did

- Added `ResponseStyle` enum to `ToolOptionsStore.swift` and wired style + web-search prefixes into `ChatViewModel.sendMessage` so the iOS composer matches the web's enriched send behavior.
- Rewrote `ComposerPlusSheet.swift` with a glass modal backdrop, compact icon grid, GitHub URL fetch, Style submenu, Project submenu, and glass panel chrome for every section.
- Replaced `AgentPill` with `AgentBotChip` (Bot off / Bot on) and converted `AgentModeBottomDeck` to a horizontally scrolling pipe-separated mode tab bar.
- Made all composer deck pills and trays glass (`BgPanel` + `.ultraThinMaterial`) with `TextPrimary` labels.

## Next

- Build iOS SiteAPIsView, CodeUsageCard, and PDF/Office signing surface.
- Run `xcodebuild` to verify Swift compiles.

## Done (verification update)

- Built `SiteAPIsView.swift` with a create-API CTA that opens Safari to the platform.
- Added `CodeUsageCard` to `CodeModeView` as a horizontal glass summary.
- Built `PDFSignView.swift` with a native PencilKit signature pad and PDF composition.
- Wired both new surfaces into `ACITabView` and `OfficeDocumentsView`.
- Regenerated `Allternit.xcodeproj` with `xcodegen`; fetched `libgit2.xcframework`.
- `swiftc -parse` passes for every touched Swift file. Full `xcodebuild` is blocked by the missing `Mesh.xcframework` (requires Go/gomobile setup that is not functional in this environment).

## Open questions

- None.

---

## Goal

Wire Memory Kernel V2 runtime hooks into the agent execution loop, checkpoint store, and heartbeat executor.

## Just did

- Wired **PreTurn Recall** in `mode-session-store.ts` (`sendMessageWithContext`) to automatically query `memoryClient.recall(text, { agentId, sessionId })` and inject formatted `<agent_memory>` context into `agentContext.systemPrompt` prior to model inference.
- Wired **PostTurn Retention** in `mode-session-store.ts` to asynchronously persist user turns on message send and assistant turns on streaming `onDone` via `memoryClient.retainTurn()`.
- Added **Tool Execution Observations** in `mode-session-store.ts` (`onToolResult`) to log tool execution results to `memory_observations`.
- Added **Checkpoint Persistence** in `agent-checkpoint-store.ts` (`setCheckpoint`) to record structured `kind: 'checkpoint'` observations on status updates.
- Added **Decision Observations** in `agent-heartbeat-executor.ts` (`executeNightlyReview`) on nightly review completion.
- Implemented **4-Way Reciprocal Rank Fusion (RRF)** and float vector `cosine_similarity` in `cmd/allternit-api/src/memory_kernel_service.rs` blending lexical match (0.25), semantic/confidence (0.35), entity graph (0.20), and 72-hour half-life recency decay (0.20).
- Implemented **Outbound Photon Message Dispatcher** (`send_photon_outbound_message`) in `cmd/allternit-api/src/allternit_bus_routes.rs` connecting agent replies directly to `https://api.photon.codes/v1/messages`.
- Completed all pending Phase 1 task batches across `docs/agent-tasks/`:
  - **Model Lab Training & Recipes** (`MODEL_LAB_TRAINING_MAP.md`, `MODEL_LAB_TRAINING_PHASE_1_NOTES.md`)
  - **Agent Hub & Packaged Bots** (`AGENT_HUB_BOTS_MAP.md`, `AGENT_HUB_BOTS_PHASE_1_NOTES.md`)
  - **Plugins, CLI, Artifacts, iOS & Docs** (`PLUGINS_CLI_ARTIFACTS_IOS_MAP.md`, `PLUGINS_CLI_ARTIFACTS_IOS_PHASE_1_NOTES.md`)
  - **Computer Use Harness Integration** (`COMPUTER_USE_HARNESS_MAP.md`, `COMPUTER_USE_HARNESS_PHASE_1_NOTES.md`)
  - **Model Lab Discover & Reorganization** (`MODEL_LAB_DISCOVER_PHASE_1_NOTES.md`, `MODEL_LAB_REORG_PHASE_1_NOTES.md`)
- Verified automated tests: Rust memory kernel tests passed 100% (3/3), frontend vitest suite passed 897 tests across 117 suites, `cargo check` and `tsc` report 0 errors.

## Next

- Run live user acceptance smoke tests across agent sessions and Photon webhook channels.
- Expand physical mobile harness and native accessibility adapters in Phase 2.

## Open questions

- None.

---

## Goal

Fix the Site APIs tab rail selection and polish the Site APIs (ApiCaptureView) UI in the Allternit platform web surface.

## Just did

- Added `site-apis` to `BROWSER_MODE_VIEW_TYPES` in `ShellApp.tsx` so opening Site APIs keeps the shell in browser/ACI mode and highlights the Site APIs rail item.
- Polished `ApiCaptureView.tsx` with design-token cards (`bg-[var(--bg-elevated)]`, `border-[var(--border-subtle)]`, `rounded-xl`), a clearer workflow step strip with step numbers and connector arrows, and empty states for sessions/contracts/no-selection.
- Converted the endpoint list from a table to compact cards and improved the replay panel and generated-client panel visuals while preserving HAR upload, contract selection, replay, client generation, publish skill, and delete functionality.
- Verification: `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` only reports pre-existing `office-*` asset errors and the `comrails-mail.store.ts` error; baseline vitest suite reports 13 passed.

## Next

- Review the rail behavior and visual polish in the browser surface.

## Open questions

- None.

---

## Goal

Build iOS parity for the renamed Agent | Bot Hub in the Allternit mobile surface.

## Just did

- Renamed visible "Agent Hub" UI strings to "agent | bot hub" across `AppMode.swift`, `AgentHubView.swift`, `MarketplaceView.swift`, `AgentSelectionSheet.swift`, `SettingsView.swift`, and `InfrastructureSettingsView.swift`.
- Refactored `AgentHubView.swift` into a Bot Home landing with `Home | Sessions | Workspace | Config` tabs, a hero with package bots, stats cards, and a templates section.
- Added a Bot on/off pill toggle in the hero that opens a populated `BotSelectionSheet` when turned on.
- Added a pipe-separated (`|`) mode selector above the bot list, binding to `AgentModeStore`'s tile selection.
- Made the composer mascot customizable: `GizziMascotPill` now shows the selected default bot's `AgentAvatarView` instead of the Gizzi image when a bot is selected.
- Updated `HistorySidebarView` so Home recents exclude bot/agent sessions (`agentId != nil`); bot sessions stay in the agent | bot hub and code sessions stay in Code mode.
- Verified the iOS target builds successfully for the `Allternit` scheme on the iPhone 16 simulator (`xcodebuild -scheme Allternit -destination 'platform=iOS Simulator,name=iPhone 16' build`).

## Next

- Run the app in the simulator to smoke-test the new hub tabs, bot toggle, mode selector, and mascot behavior.
- Address any runtime layout issues found during manual QA.

## Open questions

- None.

---

## Goal

Apply the Second Brain UI standard to the four existing mini-app views in the Allternit platform web surface.

## Just did

- Refactored `OpenClawView.tsx`, `HermesView.tsx`, `OhMyPiView.tsx`, and `VaultViewerView.tsx` to align with `BrainView.tsx`.
- Added consistent page headers with icon + title + status `Pill`, replaced hardcoded status colors with design-token classes, and wrapped content in `rounded-xl bg-[var(--bg-elevated)] border-[var(--border-subtle)]` cards.
- Reused shared components (`Button`, `Pill`, `Text`, `Input`, `Skeleton`) where appropriate and added loading skeletons and styled error states where missing.
- Preserved all existing runtime contracts: health checks, install/start/open actions, logs, Obsidian vault name handling, and OpenClaw tabs.
- Fixed introduced TypeScript narrowing errors in `HermesView.tsx` and `VaultViewerView.tsx`.
- Verification: `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` only reports pre-existing `office-*` asset errors; baseline vitest suite reports 13 passed.

## Next

- Review the visual changes for consistency and merge when convenient.

## Open questions

- None.

---

## Goal

Move the bot creation entry point out of the chat-view sidebar and into the Home rail as a collapsible "Bots" panel above Recents, with Gizzi set up as a real packaged bot.

## Just did

- Added a collapsible `BotsPanel` to `ShellRail.tsx` in Home/Chat mode, placed above the existing `RecentsPanel` and using the same expand/collapse caret widget.
- Made Gizzi a real packaged bot by updating `GIZZI_SEED` in `useAgentBootstrap.ts` with `isBot: true` and a `botProfile`, and changed bootstrap to always ensure exactly one Gizzi bot exists.
- Removed the synthetic Gizzi entry from `ShellRail.tsx` and `HomeView.tsx` so the panel renders the actual agent-store bots (now including Gizzi).
- Added a hover-revealed "Create Bot" (+) button in the Bots panel header that opens Agent Hub.
- Removed every "Create Bot" CTA from `BotRosterSidebar.tsx` (both the bottom button and the empty-state button).
- Removed `<BotRosterSidebar />` from `ChatView.tsx` so the bots strip no longer appears at the top of the chat canvas; bots live only in the left rail panel.
- Verified `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` passes cleanly.

## Next

- Refresh the browser to load the updated bootstrap and UI.
- Smoke-test: the chat canvas no longer shows a Bots strip, the left rail has the collapsible Bots panel with Gizzi, and Create Bot opens Agent Hub.
- Address any runtime issues found.
- Stage and commit scoped changes.

## Open questions

- Worktree policy: AGENTS.md requires linked worktrees, but the user's request was to fix the current checkout directly. Should we migrate to a worktree before committing?

---

## Goal

Standardize the Allternit Platform bots experience: remove the 7 hardcoded bot templates from the Bots hub, let users create/package bots in Agent Studio, rename agent-mode UI to bot-mode, and wire bot selection and `@mentions` to dedicated bot sessions.

## Just did

- Added bot packaging fields (`isBot`, `botProfile`) to `CreateAgentInput` and agent persistence (API + local registry fallback in `config`).
- Added a "Package as Bot" toggle to the agent creation flow (`HarnessStep`) with display name, tagline, accent color, and category.
- Rewrote `AgentHubBotsTab` to display user-created bots from the agent store instead of the 7 hardcoded `BOT_TEMPLATES`.
- Deleted the hardcoded `src/lib/bots/bots.manifest.ts` and `src/lib/bots/bot-icons.tsx` files now that the UI no longer depends on them.
- Renamed agent-mode UI strings to bot-mode (`BottomDock`, `ModeDock`, `AgentSelectorDropdown`, `AgentMentionDropdown`, `ChatComposer` helper text).
- Filtered bot picker and `@mention` dropdown to only show packaged bots (`isBot === true`).
- Synced bot selection in the composer: selecting a bot from the picker sets the `@mention` chip, and `@mention`ing a bot binds it as the surface's selected bot.
- Opened the bot picker automatically when bot mode is toggled on and no bot is selected.
- Updated `AgentPill` and `AgentStorefrontCard` to show bot display names, `@` prefix, accent colors, and bot taglines.
- Routed bot-mode sends in `ShellApp.handleOpenAgentSession` to `allternitAiSessionApi.createSession` (bot session) and streamed the opening message via `allternitAiChatApi.streamChat`.
- Verified `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com`; only pre-existing `ApiCaptureView` errors remain.

## Next

- Run the platform dev stack and smoke-test the create-bot → Bots hub → composer `@mention` → bot session flow.
- Address any runtime issues found in testing.
- Stage and commit the scoped changes.

## Open questions

- Worktree policy: AGENTS.md requires linked worktrees, but the user's request was to fix the current checkout directly. Should we migrate to a worktree before committing?

---

## Goal

Finish the Allternit Desktop auth/onboarding handoff: review fixes 1–13, implement the two remaining items (#14 Sidecar-backed Local Brain model routes + ModesStep rework, #15 `gizzi init` wiring), then build/test/package and commit scoped changes.

## Just did

- Implemented #14 end-to-end:
  - Added `cmd/gizzi-code/src/runtime/server/routes/sidecar.ts` exposing `/sidecar/models` (list), `/sidecar/models/search` (HF GGUF search), `/sidecar/models/install` (SSE install progress), `/sidecar/models/:tag/remove`.
  - Registered the route in `cmd/gizzi-code/src/runtime/server/server.ts` under both unversioned `/sidecar` and `/v1/sidecar`.
  - Added proxy routes in `cmd/allternit-api/src/local_brain_routes.rs` under `/api/local-brain/models/*` forwarding to gizzi-code.
  - Added `setupApi.listLocalModels` / `searchLocalModels` / `installLocalModel` / `removeLocalModel` in `surfaces/ai.allternit.com/src/services/setup-api.ts`.
  - Reworked the `ModesStep` Local Brain UI to list installed sidecar models, search HuggingFace, install with SSE progress, remove, and select as the default brain.
- Implemented #15 end-to-end:
  - Extracted reusable `initializeProject()` into `cmd/gizzi-code/src/runtime/project/init.ts`.
  - Refactored `cmd/gizzi-code/src/cli/commands/init.ts` to call the shared function (no CLI behavior change).
  - Added `POST /v1/project/init` route in `cmd/gizzi-code/src/runtime/server/routes/project.ts`.
  - Added `POST /api/onboarding/init-project` proxy in `cmd/allternit-api/src/onboarding_routes.rs`.
  - Added `setupApi.initProject()` and wired it into the wizard `finish()` handler using `data.workspacePath`.
  - Added workspace path to the Done screen summary.
- Verified code health:
  - `cargo check -p allternit-api` ✅
  - `cargo build --release -p allternit-api` ✅; copied fresh binary into `surfaces/allternit-desktop/resources/bin/allternit-api`.
  - `bun run typecheck` in `cmd/gizzi-code` ✅
  - `pnpm exec tsc --noEmit` in `surfaces/ai.allternit.com` ✅
  - `pnpm test` in `surfaces/allternit-desktop` ✅ (94 passed)
  - Desktop main/preload typecheck ✅
- Started full DMG build (`npm run build:electron:dmg` with live Clerk key) — currently running in background task `bash-z0fskqnw`.

## Next

1. Wait for DMG build to finish; inspect result.
2. Stage and commit the scoped set of files touched for this handoff, avoiding unrelated WIP.
3. Update this checkpoint once commits are ready for steering approval.

## Open questions

- Worktree policy: AGENTS.md requires sessions to use linked worktrees, but the entire handoff state (fixes 1–13) is in the main checkout. Working in main checkout to avoid losing/cherry-picking 194 files of WIP; commit guard will be triggered for approval.

## Files changed / to commit

New:
- `cmd/gizzi-code/src/runtime/server/routes/sidecar.ts`
- `cmd/gizzi-code/src/runtime/project/init.ts`

Modified:
- `cmd/gizzi-code/src/runtime/server/server.ts`
- `cmd/gizzi-code/src/runtime/server/routes/project.ts`
- `cmd/gizzi-code/src/cli/commands/init.ts`
- `cmd/allternit-api/src/local_brain_routes.rs`
- `cmd/allternit-api/src/onboarding_routes.rs`
- `surfaces/ai.allternit.com/src/services/setup-api.ts`
- `surfaces/ai.allternit.com/src/components/onboarding/OnboardingFlow.tsx`
- `surfaces/allternit-desktop/resources/bin/allternit-api` (binary refresh)

---

## Swarm E checkpoint (2026-08-09)

Goal: Complete Swarm E Enterprise Auth & Vault Phase 0.

Just did: Added V36 credential/vault schema, scoped enterprise credential management and bearer authentication, encrypted AllternitVault storage, and authenticated gateway idempotency ownership.

Next: Stage and commit the completed Phase 0 files once the linked-worktree Git index is writable.

Open questions: Commit is blocked because the sandbox denies creation of the linked-worktree `index.lock` under the canonical checkout's `.git/worktrees` directory. Builds/tests are intentionally not run under the Swarm E repository instructions.

---

## Swarm A checkpoint (2026-08-09)

Goal: Complete Swarm A Core API / Harness Phase 2.

Just did:
- Verified the SDK retry/backoff interceptor (`retry.ts`) and wired it into the Anthropic BYOK fetch path.
- Added `GET /v1/rate-limits` to the LLM gateway (`auth.rs`, `proxy.rs`, `mod.rs`) with unit tests.
- Added normalized `HarnessStopReason` taxonomy to harness types, mapped Anthropic/OpenAI stop/finish reasons via `mapStopReason`, surfaced the reason in `run()`/`done` chunks, and emitted `run.stop` lifecycle events from `RunState`.
- Added legacy OpenAI `functions`/`function_call` output support to `toOpenAIRequest` with tests.
- Updated harness tests and added `provider-request.test.ts`.
- `cargo check -p allternit-api` and `cargo test -p allternit-api --lib` pass (136 tests). Targeted `bun test` for `sdk/allternit-sdk/src/ai-runtime/harness/__tests__` passes (51 tests). Broader `bun test` in the SDK has pre-existing failures (missing `zod` dep, unimplemented Google/Local harness streaming) not introduced by these changes.

Next: Stage all Phase 2 files and commit to `ao/p2-swarm-a`, then write `docs/SWARM_A_PHASE2_NOTES.md`.

Open questions: None.

---

## Codex manual parity part 3 checkpoint (2026-08-12)

Goal: Document Allternit parity for the assigned Codex manual part 3 items
covering configuration, UI, integrations, permissions, observability, and
security workflows.

Just did: Created `docs/public/parity/codex-manual-part3.md` and its required
coverage report. Mapped project discovery, worktrees, approvals, credentials,
provider endpoints, model availability, MCP/apps, agents/hooks, web search,
TypeScript, TUI customization, analytics, OTLP, and vulnerability reporting;
marked Codex-hosted and literal-schema-only features as not applicable or
roadmap.

Next: Reviewer can validate the semantic mappings and decide whether the
documented network-proxy, Windows-isolation, TUI, OTLP, and security-workbench
gaps should become implementation tasks.

Open questions: None. Documentation-only work; no build was run.

---

## Codex Security parity documentation (2026-08-12)

Goal: Document Allternit parity for the assigned Codex Security cloud FAQ,
CLI FAQ/reference/quickstart, TypeScript SDK, and plugin quickstart items.

Just did: Created six parity pages and the required coverage report. Mapped the
plugin-backed `/security-review` workflow, provider auth, sandbox/approval
configuration, MCP, managed session budgets, and `gizzi verification`; marked
the managed scanner, typed scan lifecycle/results, threat-model store, bulk
resume, baseline matching, and SARIF surfaces as roadmap instead of presenting
generic agent infrastructure as feature parity.

Next: Reviewer can validate the mappings and decide which missing security
product contracts should become implementation work.

Open questions: The repository does not publish a guaranteed marketplace URL
for the `security-review` plugin. Documentation-only work; no build was run.

---

## Parity docs: developer commands (2026-08-12)

Goal: Document Allternit parity for the 53 assigned ChatGPT/Codex developer-command items.

Just did: Researched the Gizzi TUI command registry, global CLI flags,
keybinding schema, session lifecycle APIs, connector catalog, MCP server, work
queue, memory, preferences, permissions, and hooks. Created
`docs/public/parity/developer-commands.md` and the required coverage report.

Next: Reviewer can validate command naming and roadmap classifications. No build
is needed because the change is documentation-only.

Open questions: None.

---

## Codex manual parity part 4 checkpoint (2026-08-12)

Goal: Document Allternit parity for the assigned Codex manual part 4
configuration literals.

Just did: Created `docs/public/parity/codex-manual-part4.md` with researched
mappings for providers, MCP/OAuth, compaction and memory, tools, sandboxing,
history/OTel, TUI controls, authentication, connectors, and web search. Added
the required `.parity-reports/codex-manual-part4.md` report. Unsupported
Codex-hosted and configuration-specific controls are explicitly labeled not
applicable or roadmap.

Next: Reviewer can validate wording and roadmap classifications. No build is
needed because the changes are documentation-only.

Open questions: None.

---

## Parity docs: non-interactive, commands, prompts, administration, usage (2026-08-12)

Goal: Document the 24 assigned OpenAI ChatGPT/Codex handoff items across five
Allternit parity pages.

Just did: Researched `gizzi exec`, stdin/structured output, auth profiles,
session resume, TUI commands/keybindings/search, guarded deep links, custom
command frontmatter, admin routes/CLI, gateway budgets, spend caps, and managed
session budgets. Created the five public pages and the required coverage report;
classified hosted ChatGPT subscription allowances and implicit external posting
as not applicable to the self-host/BYOC model.

Next: Reviewer can validate terminology and cross-links. No build is needed
because the change is documentation-only.

Open questions: None.

---

## Codex manual parity part 1 checkpoint (2026-08-12)

Goal: Document Allternit parity for the 118 assigned Codex manual items through
`History & File Opener`.

Just did: Created `docs/public/parity/codex-manual-part1.md` with configuration,
provider, sandbox, MCP, session, UI, analytics, governance, and security mappings;
marked unsupported Codex syntax and SaaS-only concepts as not applicable/roadmap;
created the required `.parity-reports/codex-manual-part1.md` report.

Next: Reviewer can validate terminology and decide whether roadmap gaps should
be promoted into implementation tasks.

Open questions: None.

---

## Goal (parallel session: Second Brain rename + creation wiring)

Rename the web UI's "Brain" surface to "Second Brain", wire Clerk JWT sync into the runtime API client, and add a gizzi-code `/brain/provision` route so the empty Brain view can actually create a hosted second brain.

## Just did

- Renamed visible strings: `ShellRail.tsx` nav label, `BrainView.tsx` heading/empty/error/copy, `ViewRegistry.tsx` error fallback.
- Added `useEffect` in `ClerkPlatformAuthBridge` to push `clerkAuth.getToken()` into `api.setToken()` every ~50s and clear on sign-out.
- Created `cmd/gizzi-code/src/runtime/server/routes/brain.ts` with `POST /brain/provision` (init → relay-authenticated create → link → sync), fail-closed 401.
- Mounted `BrainRoutes()` in `cmd/gizzi-code/src/runtime/server/server.ts` under `/brain` and `/v1/brain`.
- Added `createBrain()` in `surfaces/ai.allternit.com/src/services/brain-api.ts` calling gizzi-code via `apiRequest(gizziBaseUrl() + "/brain/provision")`.
- Wired `useMutation` in `BrainView.tsx` to the `EmptyState` CTA; invalidates `['brains']` on success and toasts on error.
- Typecheck clean for both `cmd/gizzi-code` and `surfaces/ai.allternit.com`; production Vite build succeeded.
- Restarted the local gizzi-code HTTP server and verified `POST /brain/provision` returns 401 without `Authorization` and on both `/brain/provision` and `/v1/brain/provision`.

## Follow-up change: move Second Brain from Home tab to Mini-apps

- Removed the `Second Brain` `RailItem` from the Home-mode tabs in `ShellRail.tsx`.
- Added a builtin `second-brain` mini-app in `mini-app-registry.ts` (seeded under the new `allternit-mini-apps-seeded-v7` key), surfaced as an `allternit-native` mini-app with `viewType: 'brain'` so it appears alongside Vault Viewer in Browser mode's pinned Mini-apps list.
- Updated `PinnedMiniAppItem` to allow per-ID icon overrides, keeping the `Brain` icon for the Second Brain mini-app instead of the generic tool icon.
- Added `brain`, `vault-viewer`, and `oh-my-pi` to `BROWSER_MODE_VIEW_TYPES` in `ShellApp.tsx` so clicking any pinned mini-app no longer flips the shell back to Home/Chat mode; it stays in ACI/Browser mode.
- Wrapped `BrainView` in `ToastProvider` inside `ViewRegistry.tsx`; `BrainView` calls `useToast()` but the main shell canvas had no provider, causing a runtime crash and the "Second Brain Error" boundary screen.
- Fixed `cmd/gizzi-code/src/runtime/server/routes/brain.ts` so `/brain/provision` no longer forwards gizzi-code's own HTTP Basic auth header to allternit-api. In Desktop mode the Electron broker authenticates to gizzi-code with Basic auth; the route now forwards only Clerk Bearer tokens upstream.
- Switched the allternit-api create call to `apiFetchJson()` from `@/runtime/services/api/allternitApi`, which adds gizzi-code's runtime-device/local-dev auth headers (`x-allternit-user-id`, `x-allternit-desktop-access-token`) so allternit-api can authenticate the request even when no Clerk token is present.
- Typecheck clean for both `surfaces/ai.allternit.com` and `cmd/gizzi-code`; production Vite build passed.

## Next

- Obtain a valid Clerk JWT (e.g. via browser devtools `window.Clerk.session.getToken()`) and curl-test the full create→link→sync chain through `/brain/provision`.
- With the UI signed in, verify `localStorage['allternit_token']` populates on sign-in/clears on sign-out, then run the full empty-state → create → reflow click-through on a zero-brains account (now reachable via the Second Brain mini-app in Browser mode).
- Stage and commit the scoped changes.

## Open questions / limitations

- Could not complete the live JWT click-through in this session: the running Desktop renderer page was a document view, not the signed-in shell, so no Clerk session token was obtainable via CDP. The 401 path and build artifacts are verified; the full E2E needs a signed-in shell.

---

## Goal (parallel session: Allternit Manufacturing productization)

Add Allternit Manufacturing as a platform offering: create a strategic master plan, add the product to the Products Discovery catalog and spotlight carousel, and build a dedicated Manufacturing view.

## Just did

- Created `docs/ALLTERNIT_MANUFACTURING_MASTER_PLAN.md` with the 6-division structure, revenue model, build phases, 10-year roadmap, equipment list, AI agent roles, CAD-as-a-Service verticals, software licensing model, CAD/3D AI tool stack, robotics resources, and integration with the Allternit ecosystem.
- Generated `docs/ALLTERNIT_MANUFACTURING_MASTER_PLAN.html` and `.pdf` as visual review decks (16 pages).
- Added a new `Manufacturing` category and `Allternit Manufacturing` product card in `surfaces/ai.allternit.com/src/views/products/ProductsDiscoveryView.tsx`.
- Added an `Allternit Manufacturing` spotlight carousel entry in `ProductsDiscoveryView.tsx`.
- Created `surfaces/ai.allternit.com/src/views/manufacturing/ManufacturingView.tsx` as a first-class surface showing divisions, build phases, and revenue mix.
- Registered `manufacturing` as a `ViewType` in `nav.types.ts` and wired the lazy-loaded component in `ViewRegistry.tsx`.
- Inventoried relevant Twitter/CAD bookmarks on the Desktop and linked them in the master plan's reference section.
- Verified `pnpm exec tsc --noEmit` passes for `surfaces/ai.allternit.com`.

## Next

- Build the manufacturing queue/quoting software MVP when Phase 1 equipment is acquired.
- Curate the text-to-CAD, robotics, and print-farm bookmarks into actionable tool lists.
- Create follow-up specs: software architecture, equipment roadmap, product catalog, and operations manual.

## Open questions

- Should Manufacturing have its own top-level navigation entry, or remain discoverable only through Products Discovery for now?
- What is the Phase 1 equipment budget and target go-live date?

---

## Goal (ApiCaptureView polish)

Improve `surfaces/ai.allternit.com/src/views/api-capture/ApiCaptureView.tsx` per user feedback: add a browser-capture CTA in the header, clarify the Contracts by Domain empty state, surface a selection hint + New capture button when contracts exist, and polish the workflow strip / empty state spacing.

## Just did

- Added a primary "Open browser to capture" CTA in the Site APIs header next to Upload HAR / Refresh; it dispatches `allternit:open-view` with `viewType: 'browser'`.
- Clarified the Contracts by Domain empty state: helper text now explains that contracts come from HAR uploads or browser capture, and added a secondary "Capture from browser" action.
- Added a "New capture" button at the top of the domain list and a hint that selecting a domain shows its endpoints.
- Polished `EmptyState` and `WorkflowStep` spacing and icon sizing while keeping the existing components.
- Verified `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` reports no errors in `src/views/api-capture` or `src/lib/api-capture`.
- Confirmed there are no existing api-capture unit tests to run.

## Next

- Parent review and merge.

## Open questions

- None.

---

## Goal

Add native inbound webhook triggers to the Allternit platform and a day-of-week selector for automation schedules.

## Just did

- Added `V88__webhook_triggers.sql` migration with `webhook_triggers` and `webhook_trigger_deliveries` tables.
- Created `cmd/allternit-api/src/webhook_trigger_routes.rs`:
  - Protected CRUD at `/api/v1/webhook-triggers` and delivery logs at `/api/v1/webhook-triggers/:id/deliveries`.
  - Public HMAC-verified receiver at `/webhooks/inbound/:id` that creates a Rails ticket assigned to the target bot.
- Wired the new router into `cmd/allternit-api/src/lib.rs` and `cmd/allternit-api/src/main.rs` (protected v1 + public routers).
- Created `surfaces/ai.allternit.com/src/lib/webhook-api.ts` typed client.
- Created `surfaces/ai.allternit.com/src/views/settings/WebhooksSettingsPanel.tsx` with list/create/edit/delete, URL copy, and delivery logs.
- Added a `webhooks` section to `settings.config.ts` (Infrastructure group) and `SettingsView.tsx` rendering.
- Added a `WebhooksCard` to `BotHomeView.tsx` that shows trigger count and opens Settings › Webhooks.
- Created `surfaces/ai.allternit.com/src/views/cowork/DayOfWeekSelector.tsx` and integrated it into `AutomationTasksView.tsx`; it syncs with the cron day-of-week field.
- Added docs at `docs/infra/webhooks.md`.
- Verification:
  - `cargo build -p allternit-api` ✅
  - `cargo test -p allternit-api webhook_trigger_routes` ✅ (2/2)
  - `pnpm run typecheck:fast` reports no errors in the new/modified files (global pre-existing `office-*` asset errors remain).

## Next

- Smoke-test webhook creation and delivery against a running backend.
- Run the automation day picker in the browser to confirm preset/day-toggle sync.

## Open questions

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
