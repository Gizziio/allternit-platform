# Plan: Bot computer right-side panel — startup, polish, blank-screen fixes

Session: `session/bot-computer-panel` (worktree `allternit-session-bot-computer`)
Date: 2026-09-09

## Problem statement (from Eoj)

The bot computer panel on the right side of the desktop app:

1. **Enters the screen on startup** — it should never appear unless opened by the user.
2. **Looks wrong** — spacing/polish off, hard-coded tan (`#D4B08C` / `rgba(212,176,140,…)`) in the chrome.
3. **The computer doesn't actually land in the panel** — basically blank, nothing works.
4. Should be **bots-only**, opened by clicking the icon in the top-right of the bot chat.

## Root causes found

- `browserAgent.store.ts` persists `connectedBotId` (localStorage, key
  `allternit.browser.agent-sessions`) and defaults `aciSidecarExpanded: true`.
  `ACIComputerUseSidecar` (mounted globally in `ShellOverlayLayer`) treats
  `Boolean(connectedBot)` as "active", so on launch the restored bot id makes
  the right-side panel slide in — even if the bot was deleted or has no VM,
  in which case it renders the *ACI* branch: tan "CONNECTING…" spinner →
  "NO SIGNAL" → blank. This is the startup-enter + tan + blank trifecta.
- `BotChatSessionView.tsx:193-195` auto-opens the chat-side computer pane
  whenever `computerLive` — same auto-enter bug inside the bot chat.
- `BotComputerViewport` compact mode (`layout="pane"|"aci"`) has **no
  provision/start affordance**: with no VM it shows a static "No virtual
  computer yet." and when the desktop is off/stopped it renders a black box.
  So even when opened deliberately, "nothing works with it for real."
- Sidecar bot mode keeps ACI chrome around the viewport: generic "BOT COMPUTER"
  mono label, ACI status message, `ACIEngineBar`, double headers, and the tan
  hard-coded in the ACI screen states.

## Changes

### `surfaces/ai.allternit.com/src/capsules/browser/browserAgent.store.ts`
- [ ] Default `aciSidecarExpanded: false`.
- [ ] Remove `connectedBotId` from the zustand `partialize` (do not persist).
  (Runtime behavior unchanged while a bot chat is open; on next launch the
  panel no longer self-opens. Existing stored payloads keep the field, it is
  just never re-saved.)

### `surfaces/ai.allternit.com/src/views/bots/BotChatSessionView.tsx`
- [ ] Delete the `useEffect(() => { if (computerLive) setComputerOpen(true); }, [computerLive])`
  auto-open. The pane opens only via the top-right "Computer" button
  (`aria-pressed` toggle already wired).
- [ ] Clear `connectedBotId` on unmount so leaving the bot chat disconnects
  the global sidecar.

### `surfaces/ai.allternit.com/src/capsules/browser/ACIComputerUseSidecar.tsx`
- [ ] Gate bot mode on an actual computer capability:
  `botComputerActive = Boolean(connectedBot && (connectedBot.vmOperator?.enabled || botVm))`
  so bots without a VM never spawn the panel.
- [ ] Bot mode chrome: clean header (bot avatar + name + live status + close),
  drop `ACIEngineBar` and the ACI status/message/adapter row for bot mode;
  viewport keeps its own controls.
- [ ] Replace hard-coded tan `rgba(212,176,140,…)` in the sidecar screen
  states (spinner, connecting, error hint) with design tokens
  (`var(--accent-primary)` / `var(--text-tertiary)`).

### `surfaces/ai.allternit.com/src/views/bots/BotComputerViewport.tsx`
- [ ] Compact empty state: add a "Provision computer" action (uses existing
  `handleProvision`) instead of dead text.
- [ ] Compact off/stopped state: show status + Start/Resume actions instead of
  a bare black box.

## Verification
- [ ] `bun run typecheck` (or repo-standard equivalent) in `surfaces/ai.allternit.com`.
- [ ] Unit tests: `bot-computer-vnc.test.ts` + any sidecar/viewport-adjacent
  suites via vitest.
- [ ] Manual smoke (documented, may be deferred to Eoj): launch desktop app →
  no panel; open bot chat → no panel; click top-right Computer → pane opens;
  provision → desktop lands in pane.

## Out of scope
- ACI engine (non-bot) sidecar auto-open while a task runs — unchanged.
- `ACIComputerUseView` (browser capsule overlay) — untouched.
- Desktop release path / electron-builder — no changes there; platform SPA only.
