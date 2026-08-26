# Steering checkpoint

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

## Goal (platform polish: Site APIs / HAR-derived API Capture audit & redesign plan)

Audit the current Site APIs surface and HAR-derived API capture flow, research open-source patterns and GitHub projects that do the same workflow, identify the root causes of the spacing/wiring/cross-surface failures, write a research-backed redesign plan, and begin implementation of the highest-impact fixes.

## Just did

- Audited the full capture stack:
  - Frontend: `ApiCaptureView.tsx`, `api-capture/store.ts`, `api-capture/api.ts`, `BrowserApiCaptureButton.tsx`, `BrowserChatPane.tsx`.
  - Desktop: `browser-capture-manager.ts`, `unified-main.ts` IPC handlers, `preload/index.ts` bridge.
  - Backend: `cmd/allternit-api/src/har_api_routes.rs`.
  - Extension: `surfaces/allternit-extensions/allternit-extension/` manifest and sidepanel.
- Found concrete bugs: desktop capture tore down all global `webRequest` listeners, response bodies were not captured, concurrent sessions raced, the "Open browser to capture" CTA opened the browser landing page, generated clients were stubs, and the extension had no capture permissions.
- Researched GitHub projects: `neo`, `har-to-curl`, `reverse-api-engineer`, `zapi`, `vespasian`, `har-to-openapi`, `bluebox-sdk`, `har-capture`, `mitmproxy`, `apify/crawlee`, Chrome DevTools Protocol, and Vercel's `agent-browser derive-client` skill.
- Documented capture options for Chrome extensions: `webRequest` (no bodies), `chrome.debugger` + CDP (full capture), DevTools panel, content-script interception.
- Wrote `docs/SITE_APIS_CAPTURE_REDESIGN_PLAN.md` with root-cause table, proposed adapter-based cross-surface architecture, backend service outline, phased implementation plan, acceptance criteria, and open questions.
- **Implemented Phase 1 & 2 fixes:**
  - Hardened `browser-capture-manager.ts` with per-session dispatch, global listener lifecycle, concurrent-session guard, and request-body capture; added 8 passing unit tests.
  - Created `src/lib/api-capture/arm.ts` so the Site APIs surface can arm the ACI browser capture button across components.
  - Rewired `BrowserApiCaptureButton` into the ACI browser top row (`BrowserCapsuleEnhanced.tsx`); it now auto-starts capture when it receives an arm signal whose domain matches the active tab.
  - Redesigned `ApiCaptureView.tsx` with a `CaptureLauncher` CTA, URL prompt, expandable endpoint cards, improved replay form, compact mode prop, and better Allternit spacing.
  - Added an "APIs" tab to `BrowserChatPane` so Site APIs are usable in the compact ACI sidepanel without clipping.
  - Wired the desktop `browserCapture` API end-to-end:
    - Added `browser-capture:*` IPC handlers in `surfaces/allternit-desktop/src/main/unified-main.ts` backed by `browser-capture-manager.ts`.
    - Exposed `window.allternit.browserCapture` in `surfaces/allternit-desktop/src/preload/index.ts`.
    - Added the TypeScript contract to `surfaces/ai.allternit.com/src/lib/globals.d.ts`.
- Verified health:
  - `pnpm test -- browser-capture-manager.test.ts` in `surfaces/allternit-desktop` ✅ (8 tests)
  - `pnpm run typecheck` in `surfaces/allternit-desktop` ✅
  - `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` in `surfaces/ai.allternit.com` reports no new errors in touched files (baseline pre-existing errors unchanged).

## Next

1. Build the `services/api-capture/` Rust backend (Phase 3): SQLite persistence, real client generation, server-side replay proxy.
2. Spike the Chrome extension `chrome.debugger` capture adapter (Phase 4).
3. Add agent-facing tools for `api_capture_record` / `api_capture_stop` / `api_capture_replay` (Phase 5).

## Open questions

- ~~The integration tracker claims `services/api-capture/` is done, but it is not present in this checkout. Should we recover that branch or re-implement?~~ **Answered:** `ao/p1-apitap-capture` does not exist locally or on `origin`. We are implementing from the current prototype.
- Should the extension use `debugger` permission (full capture but Chrome warning bar) or a DevTools panel approach?
- How should auth/cookie replay be handled safely in the server-side replay proxy?

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

## Goal (platform polish: Agent | Bot Hub, ACI, Code, Home, iOS)

Work through the user's platform todo list across ACI, Code mode, Home/bots, and iOS parity, starting with the smallest high-impact UI fixes and progressing to larger features.

## Just did

- Created linked worktree `allternit-session-platform-polish` from `main`.
- Copied 192 dirty/untracked files from the shared checkout into the worktree so we work on the current state (WIP from previous sessions).
- Installed dependencies with `pnpm install --ignore-scripts`.
- Established baseline typecheck: `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` reports 952 lines of pre-existing errors.
- Mapped key surfaces: `ShellApp.tsx`, `ShellRail.tsx`, `ViewRegistry.tsx`, `views/api-capture/ApiCaptureView.tsx`, `views/HomeView.tsx`, `views/AgentHub.tsx`, `views/bots/`.

## Just did (continued)

- **Site API tab rail fix**: registered `site-apis` as a `ViewType`, wired it into `ViewRegistry.tsx`, and added it to `BROWSER_MODE_VIEW_TYPES` in `ShellApp.tsx` so opening Site APIs no longer jumps the rail to Home. Added "Site APIs" to the Browser-mode rail and its More dropdown.
- **Site API tab polish**: improved `ApiCaptureView.tsx` header with a subtle gradient, larger icon container, and shadow.
- **Chat top-deck pills glass effect**: changed `InfoChip`, `ActionChip` (inactive), and the agent status pill in `AgentContextStrip` to `bg-white/5 backdrop-blur-sm` for a see-through glass look.
- **Composer + button parity**: updated the compact composer path so the + button now toggles the existing Claude-style attachment/context/style menu (rotates to ×) instead of directly opening the file picker. Extracted the menu into a shared `plusMenuPanel` variable used by both compact and full composer layouts.
- **Usage card polish**: converted `CodeUsageDashboard.tsx` from a light parchment surface to a dark glass card (`rgba(255,255,255,0.03)` + `backdrop-blur(20px)`), updated tab/range switchers, metric cards, heatmap, and model rows to match the dark glass Allternit style.
- **Agent | Bot Hub rename**: updated visible labels in `AgentHub.tsx`, `ShellRail.tsx`, rail configs (`rail.config.tsx`, `cowork.config.ts`, `code.config.ts`), `ViewRegistry.tsx` error fallback, and `ProductsDiscoveryView.tsx`.
- **Verification**: `pnpm exec tsc --project tsconfig.typecheck.json --noEmit` still reports 952 lines (same baseline; no new errors introduced).

## Next

1. Phase 2 — Home & bots rework: bot toggle modes/mascot, session routing, workspace audit.
2. Phase 3 — ACI & mini-apps: file-open integration, mini-app store/catalog polish, browser chat branding.
3. Phase 4 — Code mode: console branding, terminal session canvas redesign, ACI dev server sideline.
4. Phase 5 spikes: choose DocuSign alternative, locate and audit Allternit iOS project.

## Open questions

- User clarified rename should be "Agent | Bot Hub" (not "Agents & Bots").
- User wants me to choose the best open-source DocuSign alternative (leaning toward DocuSeal for modern API-first UX).
- iOS project exists as "allternit ios" and needs parity upgrades; exact path still to locate.
- Code canvas should be kept, simplified, and redesigned for organized terminal-session overlays.
