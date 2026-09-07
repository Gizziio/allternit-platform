# Steering checkpoint

## Goal
Phase 2 — "Visibility layer" from docs/BOT_TEAMMATES_SPEC.md, in worktree
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
