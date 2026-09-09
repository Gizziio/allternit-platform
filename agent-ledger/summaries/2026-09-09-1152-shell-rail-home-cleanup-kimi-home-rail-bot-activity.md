# Agent Work Attestation — shell/shell-rail-home-cleanup

**Date:** 2026-09-09 11:52
**Session ID:** shell-rail-home-cleanup
**Branch:** session/shell-rail-home-cleanup
**Agent:** kimi
**Commit:** 95fdac5b9 (merge commit bbf8ff7af, PR #219)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner-requested home-mode shell rail cleanup in the desktop surface
(`surfaces/ai.allternit.com`), delivered as an unsigned arm64 desktop build
plus the landed source change:

- Removed the collapsed-rail Agents mascot pill entirely (upstream effe862b5
  had folded it into the 44px collapsed-controls row; pill deleted per owner
  decision, ≤44px collapsed chrome preserved).
- Moved Groups from home tabs to a bot-mode-only tab; `groups-list` /
  `group-chat` added to `BOT_MODE_VIEW_TYPES` so the rail stays in bot mode.
- Folded the rail Inbox into the Agent Activity widget: extracted the
  `InboxRailItem` popover body into reusable `BotInboxContent`
  (`src/lib/bots/BotInboxContent.tsx`, exports `useInboxBadgeCount`); the
  panel now has Activity | Inbox tabs; bell badge = monitor unread + inbox
  badge.
- Renamed user-visible "Agent Activity" → "Bot Activity" across the surface
  (bell title, panel header, settings shortcut, composer sheet, bot runtime
  help copy, identity-channels help copy, monitor load-error string).
- Moved Remote peers out of the rail into a wide-view `RemotePeersPanel` card
  rendered by the Fabric Transport view.
- Inlined the New button as the first row of each mode's tab column (same
  geometry as tabs); moved "Continue CLI session" into the Recents panel in
  home and code modes (RailControls create-menu entry untouched).
- Fixed rail tab highlight loss: `useStickyTab` sticky selection per mode +
  ShellApp mode→view `'initial'` sync no longer steals an already-open view
  (the startup clobber that reset highlights to New).

## How it works

- Sticky tabs: each mode branch declares its tab view ids; a tab is active on
  exact `activeViewType` match, or sticky when the last-selected tab is set
  and the current view is not another known tab view of that mode.
- Initial-sync guard reads nav state via a ref so the effect doesn't re-run on
  every nav change; it seeds the mode default only when nav holds nothing but
  the seeded chat view. `'user'`/`'sync'` paths untouched.
- `BotInboxContent` dispatches `allternit:open-view` by default (bot-inbox /
  group-chat are nav-store viewTypes, not router routes), so it works from
  both rail context and the slide-over panel.

## Verification

- `pnpm run typecheck:fast`: only the pre-existing unrelated error set
  (office-{pdf,sheets,slides}-app asset declarations, UnifiedTerminal xterm
  css) — zero errors in touched files, re-confirmed after merging origin/main.
- Targeted vitest: 6 files, 31/31 pass (FloatingWidgets, GizziMascot,
  CodePreviewPane, CodeLaunchBranding, bot-inbox, bot-activity-toasts).
- Packaged build bundle-verified: `release/Allternit-Desktop-1.1.0-arm64.dmg`
  (unsigned, notarization skipped — no APPLE_ID creds) contains the Bot
  Activity strings, Continue-CLI recents row, Remote peers panel; mascot-pill
  string absent. Launch smoke deferred — previous desktop build was running
  and holds the user-data dir + port 8013.

## Known gaps / remaining work

- First (uncommitted) edit pass was wiped when an outside process checked this
  worktree out to origin/main; the work was re-applied on the new base and is
  what landed. The packaged DMG predates the rebase but is functionally
  identical — rebuild from `main` if a binary from the merged state is wanted.
- `surfaces/ai.allternit.com/vite.config.ts` had a PREVIEW-ONLY univerjs path
  patch in the preview worktree; it did not survive the checkout and was not
  committed — re-stage locally if the Vite build fails on @unverjs/core.
- Not done per owner scope at time of work: push/PR were deferred until the
  owner asked for the full ritual (done in this attestation cycle).
- Build sidecars: `allternit-local-engine` binary absent from both checkouts;
  Model Lab telemetry shows "Unavailable" in the ad-hoc build
  (`ALLTERNIT_ALLOW_MISSING_LOCAL_ENGINE=1` was used).

## Files changed

- `src/shell/ShellRail.tsx`, `src/shell/ShellApp.tsx`, `src/shell/FloatingWidgets.tsx`
- `src/lib/bots/BotInboxContent.tsx` (new), `src/lib/peers/RemotePeersPanel.tsx`
- `src/views/FabricTransportView.tsx`
- `src/views/agent-activity/{AgentActivityListView,AgentActivityPanel,AgentActivityDetailView}.tsx`
- `src/views/settings/SettingsView.tsx`, `src/views/chat/components/ComposerPlusSheet.tsx`,
  `src/views/bots/BotRuntimeConfigModal.tsx`, `src/views/agent-view/steps/IdentityChannelsStep.tsx`,
  `src/views/mail-monitor/monitor.helpers.ts`
- `.steering/checkpoint.md`, `.steering/spec.md`
