# Visibility HTTP + SDK client.bots (BA-8)

- **Date:** 2026-09-10
- **Agent:** grok (implemented + merged)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/297 · merge commit `c934a1cc5b922f73af76c38c9c1e5425447f8968`

## What landed

`GET /api/commrails/visibility` prefers `ao visibility` JSON (engine panes + waiting-on-you) and falls back to the peer registry. `@allternit/sdk` `Allternit.bots` create|list|get|archive over `/api/v1/agents` with `is_bot`. Session create accepts `bot_id`.

Also merged this session (already on main before #297): Cloud Agents Phase 4 leftover API (#295) and Fabric PWA approval/watch leftover (#294).

## Verification

- Local: `rails::visibility` 2/2; `bots.test.ts` 2/2
- GitHub Actions on #297: vitest, typecheck/build desktop, gitleaks, typography, SW cache bump — success. Vercel rate-limit ignored.

## Honest deferrals

- BA-6 computer-orgo Phase 1 (create without bot_id / Tart local) — not this PR
- BA-5 spawned-child event feed (Phase 2)
- Native CLI spawn for `bot.brain` (still catalog pickup)
- UHP spawn (BA-7)
- Do not steal worktree `allternit-ao-allternit-runtime-api`
