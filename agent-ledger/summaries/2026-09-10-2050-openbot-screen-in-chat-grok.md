# openbot-screen-in-chat — watch strip, action rows, thread mute (rq-20260910-001)

- **Date:** 2026-09-10
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/283 · merge commit `0fa6782db32101c64d8ce91c6b4801a47147baec`

## What landed

Watch-mode desktop screenshot and compact policy-audit tool rows in the bot session column (not as chat bubbles). Click the screen to open the existing `BotComputerViewport` pane. Per-thread mute in the header (localStorage). Reuses screenshot + audit APIs; no new transport.

## Verification

- vitest: `bot-thread-notify`, `bot-activity-rows`, `bot-session-chrome` → 10 passed
- GitHub Actions on #283: vitest, desktop typecheck/build, gitleaks, typography, SW cache bump — success

## Honest deferrals

Herald subagent tree (parent → spawned agents with step checklists) — no subagent event feed on this path yet.
