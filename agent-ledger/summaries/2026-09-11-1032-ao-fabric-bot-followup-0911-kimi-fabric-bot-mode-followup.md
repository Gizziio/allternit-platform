# Agent Work Attestation — Fabric Transport bot-mode follow-up

**Date:** 2026-09-11 10:32
**Session ID:** `ao/fabric-bot-followup-0911`
**Branch:** `ao/fabric-bot-followup-0911`
**Agent:** kimi (Kimi Code)
**PR:** https://github.com/Gizziio/allternit-platform/pull/330
**Merge commit:** `168012ca5`
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Follow-on polish/verify pass for Fabric Transport (fabrictransport.allternit.com,
Cloudflare Pages `allternit-remote-control`) bot mode + session UI, continuing
PRs #326 (bot-mode rail/hub) and #328 (provider crash fix, live SW v34). No
restart, no new architecture — same goal as the approved plan: Fabric PWA bot
mode = Allternit desktop bot mode.

Verification against desktop (`src/shell/ShellRail.tsx` `mode === 'bot'`):

- **Providers (PR #328 regression):** `fabric-session/main.tsx` carries
  VoiceProvider + TooltipProvider + GlobalDropzoneProvider; hub no longer
  crashes the panel. Runtime hard-refresh on a signed-in phone still needs
  Eoj's eyes — cannot be exercised without Clerk creds.
- **Rail purity:** the Bots rail uses `getBots(agents)`
  (`isBot === true && botProfile`) and nothing else — `mergeNodeBots` /
  `useUnifiedRoster` are not in the rail (verified by grep + regression test).
  Same selector as desktop `BotLaunchpadView`, so rail === desktop bot list
  for the same signed-in account by construction. If Grok/Claude/Kimi ever
  appear, it is backend data tagging them `isBot`, not this UI.
- **Hub:** canvas mounts the real `BotLaunchpadView` (greeting, BotTopDeck,
  composer, BotHubCard roster grid) behind an ErrorBoundary; `BotPickerHost`
  is mounted at App level and the rail "New" row dispatches
  `allternit:open-bot-picker` to it.
- **Brains untouched:** Chat/Code/ACI still use `fabricClient.listBrains()` +
  `FabricBrainPicker`; bot mode never touches brains.
- **Shell URL:** header Shell control = `env(VITE_ALLTERNIT_WEB_URL) ||
  https://ai.allternit.com` (not platform.allternit.com/shell).

Fixes landed:

1. **Rail rows never opened the bot chat.** `FabricBotModeRail` called
   `useStartBotSession()` with no session-started callback, so clicking a bot
   started the canonical session but never dispatched `allternit:open-view`;
   the canvas stayed on the hub. Desktop ShellRail passes the callback →
   `openBotChatView`. Now the fabric rail does the same
   (`FabricBotMode.tsx`), navigating to `BotChatSessionView`.
2. **ErrorBoundary parity.** Only the hub canvas branch had an ErrorBoundary
   (PR #328); `bot-chat` / `bot-home` / `groups` / `group-chat` could still
   unmount the whole session panel on a provider gap. All branches wrapped
   now.
3. **SW cache** `allternit-fabric-session-v34` → `v35` (fabric-session deploy
   rule; validated by the `check-sw-cache-bump` CI check).
4. **Tests.** New `src/components/dispatch/FabricBotMode.test.tsx` (rail lists
   packaged bots only — node brains excluded; clicking a bot row starts a
   session and dispatches `bot-chat-session` with the right context).
   Refreshed stale `BotsRosterSection.test.tsx` — the component moved to
   `Agent[]` props in PR #326 but the test still built `UnifiedRosterBot`
   shapes; both cases were failing on main before this change.

## How it works

Desktop bot-mode views (`BotLaunchpadView`, `BotHomeView`, `BotChatSessionView`,
`GroupsListView`, `GroupChatView`) are mounted as-is by
`FabricBotModeCanvas`; view routing is the existing
`allternit:open-view` window-event contract that the canvas intercepts, so
any desktop view that navigates (picker sheet, launchpad cards, rail rows)
drives the fabric canvas without adapters.

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com): only the 6 pre-existing
  errors on clean main (FabricSessionPanel comparison + BotsChatPage Bot
  type), none in touched files.
- `pnpm exec vitest run src/components/dispatch src/fabric-session/pages/
  BotsRosterSection.test.tsx src/lib/fabric-session-kind.test.ts` — 5 files /
  12 tests passed.
- `pnpm exec vitest run src/views/bots` — 14 tests passed.
- `vite build --config vite.fabric-session.config.ts` +
  `scripts/prepare-fabric-session-pwa.mjs` — built and prepared OK; the
  prepared `tmp/fabric-session-pwa` carries SW `v35` and the new ErrorBoundary
  component names in the fabric-session chunk.
- CI on PR #330: check-sw-cache-bump, Desktop unit tests, gitleaks,
  validate-typography all pass. Vercel (rate limit) and the ai-allternit
  Cloudflare Pages check fail identically on merged PR #329 — pre-existing
  infra state, not this diff.

## Known gaps / remaining work

- **Deploy pending human go-ahead.** The PWA has NOT been deployed. On Eoj's
  approval, deploy from the `fabric-bot-followup-0911` worktree:
  `pnpm exec vite build --config vite.fabric-session.config.ts` →
  `node scripts/prepare-fabric-session-pwa.mjs` →
  `pnpm exec wrangler pages deploy tmp/fabric-session-pwa
  --project-name=allternit-remote-control --branch=main
  --commit-hash=168012ca5 --commit-dirty=true`. After deploy Eoj must
  hard-refresh / clear Fabric Transport site data (SW v34 → v35).
- **Runtime phone verification** of the fixed rail → bot-chat navigation needs
  a signed-in session (Clerk) — deferred to Eoj.
- **Desktop binary rebuild** from merged main is required by the session
  ritual (the platform surface is desktop-bundled) — recorded as a follow-up,
  not started in-session (same deferral as `designwordmark-0911`).
- Worktree/branch cleanup intentionally deferred until after the deploy runs.
