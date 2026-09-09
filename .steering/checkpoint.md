# Checkpoint — session/bot-computer-panel (kimi-code, 2026-09-09)

## Goal
Fix the bot computer right-side panel in the Allternit desktop app (platform SPA):
(1) it enters the screen on startup, (2) polish/spacing wrong + hard-coded tan,
(3) panel is blank — the computer never lands, (4) must be bots-only, opened via
the bot chat top-right icon.

## Just did
- Scouted root causes in shared checkout (read-only):
  - `browserAgent.store.ts` persists `connectedBotId`; `aciSidecarExpanded` defaults true;
    global `ACIComputerUseSidecar` slides in on launch from the restored id (blank/tan
    ACI branch when bot or VM missing).
  - `BotChatSessionView.tsx:193` auto-opens the chat-side pane when `computerLive`.
  - `BotComputerViewport` compact mode has no provision/start affordance → dead panel.
- Created worktree `allternit-session-bot-computer`, branch `session/bot-computer-panel` @ 4ec879766.
- Wrote plan: docs/plans/plan-bot-computer-panel-fix.md

## Next
Verify: pnpm install (bg) → typecheck + vitest → commit → PR.

## Update (implement done)
All four files changed in the worktree:
- browserAgent.store.ts: `aciSidecarExpanded` default false; `connectedBotId` removed
  from partialize + persist version 1 migrate strips stale stored id.
- BotChatSessionView.tsx: auto-open effect deleted; connects to global sidecar only
  when bot hasVm; clears connectedBotId on unmount.
- ACIComputerUseSidecar.tsx: botComputerActive gated on vmOperator.enabled || botVm;
  bot-mode header = avatar + name + running dot + close (ACI chrome/engine bar hidden);
  hard-coded tan rgba(212,176,140,…) replaced with design tokens.
- BotComputerViewport.tsx: compact mode now has Provision CTA (no VM), provisioning
  spinner, and Start/Resume actions (off/stopped) instead of dead text/black box.

## Open questions
- ACI (non-bot) task sidecar auto-open: keeping as-is (out of scope).
