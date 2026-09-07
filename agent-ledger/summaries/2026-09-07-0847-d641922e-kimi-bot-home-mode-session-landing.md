# Session d641922e (kimi): Bot home mode + full-stack bot session landing fix

**Date:** 2026-09-07 08:47
**Branch:** `session/d641922e` @ `762eeb5e1` → **merged to main @ `792f20d4f` (PR #106)**
**Plan:** session plan `spoiler-shang-chi-damage.md` (approved in-session, 2 scope decisions confirmed by owner: full-stack session fix; detail view grouped into 4 sections)
**Execution:** 4 parallel coder agents (mode plumbing / rail+session view / detail view / session fix) off a 3-agent explore audit, then an integration-verify pass by the orchestrator.

## What was done

### Bot becomes a first-class home mode
- `AppMode`/`AgentModeSurface` extended with `'bot'` across ~25 files (unions, surface-keyed records, mode whitelists, gizzi surface config, themes, session-kind classifiers).
- Composer pill converted from Chat/Cowork two-way + separate Bot pill to a **three-way Chat/Cowork/Bots segmented switch** (`BottomDock.tsx`); the broken "Choose a bot / Bot Workspace" overlay (`AgentSelectorDropdown.tsx`) and all its triggers deleted.
- New `BotLaunchpadView` (`bot-launchpad` nav view, non-singleton): shared launch geometry/greeting (`launchScreenLayout`, `LaunchHeader`, new `BOT_LAUNCH_GREETING`), pinned-first bot grid reusing `BotHubCard` (first live consumer of `bot-roster` `pinnedBotIds`), hover gear → `bot-home` detail, empty state → CreateBotForm.
- New `BotPickerSheet` bottom drawer (modeled on `ComposerPlusSheet`): pinned bots (unpin), searchable all-bots with pin toggles, group chats, New bot / New group chat; mounted on the composer's "+" path only in bot surface; selecting a bot lands in `bot-chat-session`.
- Gizzi entrance fires automatically on surface change (`useGizziManager` uniqueKey remount); bot avatar swap unchanged.
- Subtle bot-mode background in `WorkspaceBackground` (`--view-bot-bg`, dot-and-orbit texture, teal `--accent-bot` family) distinct from cowork's grid; 0.5s cross-fade preserved. Theme tokens in `theme.css`.
- `handleModeChange` bot branch → `bot-launchpad`; `ModeSwitcher` + `RailControls` gained Bot entries.

### Shell rail in bot mode (`ShellRail.tsx`)
- New `mode === 'bot'` branch: Bot Hub rail item, Pinned Bots panel, Bots panel (pinned-first, then canonical-session activity), Group Chats panel with unread badges (`BotRailRow`/`BotGroupRailRow`).
- **Bot rows open the bot's session (canonical reuse via `useStartBotSession` → `openBotChatView`), never the detail view** — per owner spec.
- Pre-existing `isAgentSession()` recents exclusion of bot sessions left intact.

### Session view + detail view
- `BotChatSessionView` header avatar is now a tappable "Bot settings" chip → `bot-home` detail; `fetchMessages` `ses_*` id guard removed (store no-ops safely for local ids).
- `BotHomeView` consolidated 8+ tabs → 4: **Chat & Sessions / Tasks & Automation / Runtime & Desktop / Data & Config** (all functionality preserved, regrouped; `SectionHeading` helper). Inline error banner under header actions (moved out of the task modal); `handleSubmitTask`/`handleCreateProjectSession` guard on null sessionId. `HomeView.handleStartBotSession` same treatment.

### Session landing fix (root causes — the "bot sessions never land" bug)
- **Rust (`agent_session_routes.rs`):** client session metadata now persisted via the **existing V100 `session_metadata` table** (`DbHandle::set/get_session_metadata` existed but were unused by routes — no new migration needed, deviation from plan noted); `transform_session` merges stored metadata over the synthesized bag and emits camelCase `agentId` (keeps snake too); `update_session` merges metadata keys; 403 surface gate returns explicit `agent_not_allowed_on_surface` body.
- **Client (`mode-session-store.ts`):** backend response merged UNDER request options metadata (`definedEntries` helper strips undefined) — bot identity (`isBot`, `botCanonicalFor`, `agentId`, …) survives round-trips; catch block treats `metadata.isBot === true` as local-capable → bot sessions keep a working `temp-…` local session on backend failure instead of being deleted.
- **`useStartBotSession.ts`:** canonical reuse no longer requires `ses_*` id prefix; `warning` state ("Running locally — sync pending"); catch paths call `onSessionStarted` with surviving local session (`recoverLocalBotSession`) — navigation is never swallowed.
- `bot-e2e-desktop.cjs` re-pointed at this repo's desktop surface (`ALLTERNIT_DESKTOP_DIR`, honors `ALLTERNIT_PLATFORM_URL`; desktop dev port 3014, vite web dev 3013).

## Verification evidence
- `cargo check -p allternit-api` ✅ (65 pre-existing warnings); `cargo test -p allternit-api --lib` **653 passed, 0 failed** (refinery migration chain applies V100 cleanly to scratch SQLite).
- `pnpm typecheck` (surfaces/ai.allternit.com) ✅ zero errors in touched files; only pre-existing univerjs `office-sheets-app` (9) + xterm errors remain.
- `vitest run src/views/chat/components/ src/lib/bots/` **324 passed** (35 files, incl. rewritten BottomDock tests 5/5, ModeDock 5/5).
- Integration: orchestrator re-ran full typecheck after all four tracks landed; resolved one stale-tsbuildinfo false positive and pre-existing stash-pop conflict markers in `ShellRail.tsx`/`BotHomeView.tsx` found in the shared checkout (not from this session's agents).

## Incidents / honest deferrals
- **Live desktop smoke test not run** — the manual UX flows (pill switching, drawer, rail clicks, reload persistence) need the app running; `bot-e2e-desktop.cjs` is re-pointed and ready. Recommend owner run it.
- **Shared-checkout hygiene:** the shared main checkout held other sessions' uncommitted work (terminal tile resize/font features, office addin deps, xterm typings, desktop backend/mesh managers). Only one file was mixed with this session's work — `terminal-workspace.store.ts` (foreign `height`/`fontSize`/`setTileHeight`/`setFontSize` vs this session's one-line `'bot'` union) — split: worktree carries only the `'bot'` line; foreign work left untouched in the shared checkout. All other session files reverted to HEAD there after merge; two new files removed from the shared checkout (they now arrive via the merge).
- Shared-checkout `git pull --ff-only` is intentionally **deferred** — the foreign dirty files overlap the office-ext commits, so the pull must wait until those sessions merge/pull (same precedent as the office-ext ledger entry).
- Plan deviations: (1) V100 table reused instead of new V133 migration; (2) Bot accent color chosen teal `#2DD4BF` dark / `#2E9E97` light (owner was not consulted — reversible token change in `theme.css`); (3) `AgentGalleryCard.tsx`/`RecentsView.tsx` gained minimal forced `bot` entries in `Record<AppMode>` maps (typecheck-forced).
- Ledger/attestation follows the office-ext precedent: attestation PR (this file) rather than a direct main commit, because the shared checkout cannot pull while foreign sessions' uncommitted work overlaps incoming commits.

## Coordination notes
- Parallel `bots-p01` session (TEAMMATES spec Phase 0+1, ff-merged earlier today) touches adjacent areas (rail teammates section, routines, presence); PR #106 merged with **no conflicts**, but follow-up reconciliation of rail section ordering (Pinned Bots vs TEAMMATES) may be wanted.

## Addendum (same day, PR #110 @ 22b92f5ae)
Live-debugged follow-up: bot sessions opened but sending silently failed ("Cannot stream a message before a live session exists: temp-…", unhandled). Root cause: the API's sqlite DB (deliberately downgraded by another session, `.bak.before-v132-downgrade-20260906`) contains only 10 seeded agents — no user bots — so the surface gate 403s every bot session create; the local temp fallback then cannot stream. Fix (client-side, DB untouched): ensure-registration before createSession + send error banner. NOTE for future sessions: the desktop preview worktree (`allternit-preview-113399b28`) builds gizzi-code only after manually symlinking `node_modules/@allternit/gizzi-sdk → ../../packages/sdk` and building `packages/sdk` dist — pnpm-only installs can't build cmd/gizzi-code (build-production.js resolves gizzi-sdk via node_modules, not tsconfig paths).

## Addendum (same day, PR #112 @ cf87c933e)
Startup crash follow-up: the bots-p02 Phase-2 visibility merge added `useBotActivityToasts()` to ShellAppInner, whose `useToast()` threw `useToast must be used within ToastProvider` — no `<ToastProvider>` existed anywhere above ShellAppInner in the desktop shell tree, so the desktop app died on the AppRoot error boundary at startup. Fix: mount `<ToastProvider>` inside `GlobalDropzoneProvider`, wrapping OnboardingGate + ShellAppInner in ShellApp. Verified safe to nest (independent context state; overlay is fixed-positioned `top-4 right-4 z-[190]`), and the shell-level wrapper also covers the other previously provider-less shell-tree useToast callers (cowork TasksView/AuditLogViewer, dispatch panels, swarm views, nodes, RuntimeBoard, marketplace). Verified: `pnpm typecheck` zero errors in ShellApp.tsx (10 remaining errors all pre-existing office-sheets/xterm). Desktop app not run per instructions.
