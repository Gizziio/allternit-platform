# Steering checkpoint — session/fac1893b

## session/fac1893b (merged)
Fix Allternit desktop modal overlays (white theme-aware surfaces instead of old tan) and overhaul the Settings overlay (responsive bounds, consolidate duplicate tabs, wire dead controls to real implementations, remove placebos). Approved plan: agent plan file `doctor-fate-green-lantern-spectre.md`.

## Just did
- Created session worktree `allternit-session-fac1893b` on branch `session/fac1893b` from `origin/main` (113399b28). Shared checkout untouched (it holds other sessions' uncommitted work).
- Investigation complete (4 explore reports): tan sources = light-theme glass/surface-overlay/shell-dialog-bg tokens; `useSettingsState` has ~23/25 write-only keys; real wiring targets identified for Fabric Transport, Security, Diagnostics; duplicates: environment≡gizziio-code service URLs, compute⊂infrastructure, shortcuts≈fiction, agents setup≡agent-hub.
- **Phase 1 done (uncommitted):** light-theme tokens in `theme.css` switched to white (`--glass-bg*`, `--surface-overlay` → white rgba; `--shell-dialog-bg` → `var(--bg-elevated)`); dark block untouched. Audited all `fixed inset-0` overlays: fixed tan floating surfaces in Modal.tsx backdrop fallback (→ neutral black), DependencyConflictModal (hardcoded dark-brown glass → `var(--glass-bg-thick)`), AddCloudCredentialForm, AttachmentPreview, StudioOnboardingWizard, ThreadsView confirm, PolicyGating, ArtifactViewer, PolicyManager, SecurityDashboard, PurposeBinding (all → `var(--bg-elevated)`); SettingsView radial tan tint → `rgba(0,0,0,0.02)`. Already white / left: SettingsView dialog (`--view-settings-bg`), CapabilitiesManager+PluginManager subtree (white inline overrides), ControlCenter/BotPickerSheet/BrowsePluginsOverlay (glass tokens), AddSSHConnectionForm (intentionally dark), app canvas + full-page views keep warm tan per owner scope.
- **Phase 2 done (uncommitted):** SettingsView overlay bounds — dialog `w-[min(1000px,calc(100vw-3rem))] h-[min(80vh,880px)] min-w-0` (max-w kept), outer padding `p-4 sm:p-6`, sidebar `hidden sm:block w-[220px]`.
- **Phase 3 done (uncommitted):** nav consolidation per plan — removed `environment` (service URLs now embedded in gizziio-code via `EnvironmentSettings`; `ServiceUrlSettings.tsx` deleted), `compute` (ComputeSettings.tsx deleted; InfrastructureSettings gained Billing & Credits / Cloud Desktops / BYOC tabs; redirects `vps`/`cloud-instances`/`cloud-credentials`/`compute` → `infrastructure`), `shortcuts` (→ `about` redirect; verified-only shortcut table — ⌘⇧M/⌘F/⌘⇧H/⌘⇧A — now rendered inside renderAboutPanel; fictional SHORTCUTS const + renderShortcutsPanel deleted; ⌘, has NO verified listener anywhere and was omitted), `general` (panel deleted; auto-save row moved to Appearance as "Auto-save chat drafts", key unchanged; dead language/timezone/telemetry/system-message hooks removed; SettingsDrilldown defaults now `appearance`). Agents dedup: AgentOpsPanel "My Agents" tab now opens agent-hub view (close-settings + open-view) instead of embedded AgentView. Regrouped nav into account/platform/products/infrastructure/customize/about; **kept `agents` nav item in infrastructure** (task list omitted it but removing it would orphan the dedup'd panel — flagged for owner). BYOC: EnterpriseByocPanel was NOT reachable in InfrastructureSettings → added as third new tab.
- **Phase 4 done (uncommitted):** A) DispatchSettingsPanel fully rewired — Fabric Transport panel now shows this-node runtime status via `useRuntimes()` + pending permission/question counts via `useRemotePendingCounts()`, opens Fabric dashboard via `openFabricSessionWindow()`, real push-notification toggle (serviceWorker /sw.js + `pushClient`), dropped 4 dead notify* sub-toggles + code-permission dropdown + static file-access/accessibility rows (all verified placebo; `DispatchView.tsx` that still references those keys is dead code — defined, never imported). B) SecurityPanel: threat level card now real (`getSecurityOverview()` with fallback derived from open-violation count; low/medium/high/critical → emerald/amber/rose), "+ New policy" → open-view `policy`, Purpose Binding tab fetches real `listPurposes`/`listAgentPurposeBindings`/`listPurposeViolations` (3 stat cards + binding rows) and opens the `purpose` view. C) DiagnosticsPanel: "Session metrics" placeholder replaced with real 4-stat rollup from `useAgentMetricsStore` (run-weighted latency/success, loading skeleton + empty state) plus new "Rails services" Ledger/Gate/Leases health rows from `railsApi.health()`. D) Privacy panel: dead "How we protect/use your data" buttons and `privacy.locationMetadata`/`privacy.improveModels` toggles removed (no readers); kept export + memory rows, added "Privacy policy" link (https://allternit.com/privacy, matches About footer idiom). E) Appearance: `compactDensity` now sets `<html data-density>` + `[data-density='compact']` spacing-token overrides in theme.css; `showSidebarLabels` gated in ShellRail (RailItem label span + Home/Code/ACI switcher) — required new reactive path: `useSettingsState` setter now dispatches `allternit:setting-changed`, new `useSettingsValue` hook listens (same-tab + cross-tab via `storage`). F) ChatComposer drafts: per-session `allternit.drafts.<sessionId>` debounce-save (400ms), restore on session switch (injected prompt wins), clear on send, gated on `general.autoSave`. G) Models toggle relabeled "Streaming (local models)"; ollama provider generate() now reads `models.streaming` (default true) — non-streaming path POSTs `stream:false` and yields one text-delta/usage/done from the single JSON body (shared `emitChatChunk`); pull/load/unload `stream` flags untouched (not response streaming). H) Placebo sweep after repo-wide grep (no readers anywhere): removed gizziio-code draw-attention/browser-tools/persist-sessions/branch-prefix/auto-PR/autofix-PR controls + code-theme selects & static preview, extensions auto-update/builtin-node card, cowork dispatch toggle; kept `gizziio-code.bypassPermissions` (not on approved removal list — flagged for owner; also has no reader). Cleaned orphaned imports (SettingsCard/SettingsCardRow/SETTINGS_SELECT_CLASS).

## Next
- Phase 6: commit/push/PR per ritual (commit-gate applies), ledger attestation, cleanup. (Verification done — see below.)

## Verification (Phase 5, done 2026-09-07)
- **Install:** root `bun install` only installed root pkgs (bun didn't read pnpm-workspace.yaml); surface-local `bun install` failed on `workspace:*` deps. Fallback `pnpm install --filter @allternit/ai...` at worktree root succeeded (56s, pnpm 10.28.0 per packageManager). Shared checkout untouched.
- **Typecheck** (`bun run typecheck`, tsc --noEmit): 1 introduced error — DispatchSettingsPanel.tsx:108 `subscription.toJSON()` typed as DOM `PushSubscriptionJSON` (optional endpoint) vs SDK's required-endpoint type. Fixed by building the payload explicitly + throwing on missing endpoint. Re-run: clean, 0 errors. No pre-existing errors observed in the full-program run.
- **Unit tests:** SettingsView.test.tsx (1/1) + CloudInstancesPanel.test.tsx (3/3) pass; loopback (19), EnterpriseByocPanel (1), ComputeBillingPanel (1), ControlCenter (1), FloatingWidgets (6) all pass — 32/32. Only React `act(...)` warnings from BrainsPanel fetch, pre-existing pattern.
- **Build:** `bun run build` — see result below (was running at checkpoint time; confirmed clean).
- **Live smoke** (vite dev on :3013, Playwright chromium, worktree tmp/smoke.mjs): app boots to shell with 0 page errors; console errors are only backend 401/502s (no rails/api running — expected). `allternit:open-settings` opens a **white** settings dialog with pruned nav (no General/Shortcuts/Environment/Compute); at 700px viewport the dialog respects the min() clamps (sidebar still visible ≥sm=640px as designed). Account footer popover renders white. Screenshots: `tmp/smoke-1-boot-1400.png`, `tmp/smoke-2-settings-1400.png`, `tmp/smoke-3-settings-700.png`, `tmp/smoke-4-after-click.png`. Note: first-run onboarding portal had to be bypassed via seeded `allternit-onboarding-storage` localStorage for the shell to be visible.
- **Files modified during verification:** `surfaces/ai.allternit.com/src/views/settings/DispatchSettingsPanel.tsx` (the one typecheck fix); scratch: `tmp/smoke.mjs`, `tmp/*.png`, `tmp/vite-dev.log` (uncommitted scratch, safe to delete).

## Open questions
- Whether the user wants to review before push/merge (will pause at that point).
- Backend availability for live smoke of rewired panels (governance overview, agent metrics) — will note honestly if unavailable.

---

## session/bots-p02 (from main)

Goal Phase 2 — "Visibility layer" from docs/BOT_TEAMMATES_SPEC.md, in worktree
`/Users/joe/altw/allternit-session-bots-p02` (branch session/bots-p02, main
@ 5bd4fc589 which includes Phase 0+1). Parent lands the branch — DO NOT
git commit/push. Verify with: npx tsc --noEmit, npx vitest run,
bun run build (may still be broken by the other session's univerjs state —
note only, do not fix), cargo check -p allternit-api.

## Phase 2 status: CODE COMPLETE, verification running
- D1 DONE: `lib/bots/bot-activity-watermark.ts` — zustand store
  (watermarks/focusedSessionId), `seedWatermark` (set-if-absent → history
  never unread), `markSeen` (monotonic), `markAllSeen` (Inbox mark-all-read),
  `computeHasNewActivity` + `canonicalActivityAt` pure helpers,
  `useBotHasNewActivity(botId)` (badges when activity > watermark AND chat
  not focused; focused → markSeen refresh-in-place), `useSyncBotWatermarks(
  viewType, bots)` mounted in ShellApp.tsx (seeds on mount + new bots,
  mirrors focused session for chat/bot-chat-session views). Rail dot wired
  into TeammatesRailRow next to the mail pill.
- D2 DONE: `lib/bots/bot-activity-toasts.ts` — pref at
  `allternit:bot-activity-toasts` (default OFF; localStorage with in-memory
  fallback — this env's jsdom localStorage throws); lifecycle selector
  `isToastableBot` (archived/deprecated/hidden never toast); `detectBotDmMessage`
  (metadata botId/fromBotId/botName/botAuthor markers → DM form
  "🤖 New message for <bot>", undeterminable → generic "<bot> has new
  activity" per spec fallback); `clipPreview` 140; `useBotActivityToasts()`
  mounted in ShellApp next to routine timer; reuses the existing
  ToastProvider/useToast system (ViewRegistry mounts it globally);
  duration 4s, dismissible (built-in X), stack capped at 3 (oldest removed),
  "Open chat" action → canonical chat. Pref toggle UI lives in the Inbox
  pane footer.
- D3 DONE: `src/shell/ShellRail.tsx` — `InboxRailItem` (Bell) after
  Customize in HOME TABS; badge via `computeInboxBadge` (mail unread +
  visible attention + new-activity watermarks, pure helpers in new
  `lib/bots/bot-inbox.ts`); pin-able popover (side=right, w-80, pinned state
  at `allternit:rail:inbox-pinned`; pinned ignores outside-click close until
  explicit close/unpin); sections Mail (threads from loadThreads, newest
  first, avatar/subject/count/relative/unread dot; click → bot-inbox),
  Needs attention (getVisibleAttention via selectVisibleBotAttention, click
  → canonical chat), Active (presence working/active, click → chat);
  header: Mark all read (acknowledgeMail per unread/ack message +
  markAllSeen watermarks), pin toggle, close. `RailItem` gained optional
  `badge` prop. DEVIATION: loadThreads is called once with the first bot's
  id (railsApi.mail.threads() is global; per-bot concurrent calls would
  race the store's single threads array) — threads still enriched from that
  bot's perspective.
- D4 DONE: `cmd/allternit-api/src/bot_assets.rs` (NEW file — avoids the
  other session's WIP in agent_session_routes.rs): POST/GET
  `/bots/:id/avatar` mounted via one-line `.nest("/api", …)` in main.rs +
  one-line `pub mod bot_assets;` in lib.rs; stores
  `~/.allternit/bot-assets/<id>.json` (tmp+rename atomic write), id
  traversal guard, type ∈ geometric|pet|image, data must be object.
  `cargo check -p allternit-api` PASSED (4m09s, only pre-existing warnings).
  Surface client `lib/bots/bot-assets-api.ts` (save/get, 404 → null, all
  failures graceful). Wiring: CreateBotForm saves generated/existing
  BotAvatar after createAgent (generates deterministic one when absent —
  form-created bots carry legacy AvatarConfig only); EditAgentForm saves
  botProfile.avatar after updateAgent when isBot.

## Tests (new, colocated — all passing in isolation)
- `lib/bots/bot-activity-watermark.test.ts`: seed set-if-absent, markSeen
  monotonic, markAllSeen, computeHasNewActivity, canonicalActivityAt,
  useBotHasNewActivity badge + focused refresh-in-place (renderHook with a
  zustand stand-in for ChatSessionStore).
- `lib/bots/bot-activity-toasts.test.ts`: pref default-off roundtrip,
  isToastableBot suppression, DM detection, clipPreview, dispatch gating
  (pref off / generic / DM form / archived suppressed / focused suppressed).
- `lib/bots/bot-inbox.test.ts`: countUnreadBotMail, selectVisibleBotAttention
  filtering, countNewActivityBots (focused excluded), computeInboxBadge sum.

## Verification (final)
- tsc: clean on all touched files (only the known xterm/univerjs
  environmental errors remain).
- Full vitest: 169 files — 1283 passed, 0 failed, 14 skipped. Only 2 failed
  SUITES: UnifiedTerminal.test.ts + CodeCanvas.test.tsx fail to LOAD (xterm
  not installed in the shared checkout) — environmental, untouched here. The
  ComputeBillingPanel/PluginManager pair that flaked in one full run passed
  in isolation and on the re-run — pre-existing full-suite timing
  sensitivity, not from this phase.
- bun run build: STILL FAILS on the same univerjs MISSING_EXPORT
  (docs-ui@0.25.1 vs core@0.21.1 stale install in the shared checkout, via
  the vite alias in vite.config.ts:17) — environmental, NOT fixed per
  instructions (do not touch the other session's dependency state). All
  modules transform; failure is link-time in node_modules.
- cargo check -p allternit-api: PASSED (4m09s, pre-existing warnings only).

## Open questions / notes
- node_modules symlinks (3) are untracked; must not be committed.
- localStorage is unavailable/throwing in this vitest jsdom env — pref
  helpers carry an in-memory fallback (prod behavior unchanged).
- The other session's WIP in agent_session_routes.rs untouched; bot_assets
  is a new file + two one-line registrations.
