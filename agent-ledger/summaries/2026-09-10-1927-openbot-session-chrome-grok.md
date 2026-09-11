# openbot-session-chrome — pet avatars + long-running bot session chrome (rq-20260910-001)

- **Date:** 2026-09-10
- **Agent:** grok (continuation after PR #275)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/279 · merge commit `232102ee223a9da0148b78d096e622aaf598c7aa`

## What landed

Phase 2 UX slice of `openbot-policy-gateway` (avatars + palatable long-running sessions). `@mention` routing and multi-bot group rounds were already in tree (`ChatComposer`, `mention-handoff.service`, `group-chat.service`) and were not rewritten.

- Default `generateBotAvatar` is a pet companion (not 50/50 geometric).
- Pet SVG is head+body with species ears/muzzle.
- Bot 1:1 sessions: status line, day separators, compact stretches older than 48h. Policy/activity stays in the governance panel.
- Group rounds: per-member typing presence from the last `@mention`.

## Verification

- vitest: `bot-session-chrome`, `bot-avatar.service`, policy governance/audit → 32 passed
- GitHub Actions on #279: vitest, desktop typecheck/build, gitleaks, typography, SW cache bump — success

## Honest deferrals

- Herald-style subagent telemetry tree
- Computer screen streaming inside chat
- Per-thread notify settings
