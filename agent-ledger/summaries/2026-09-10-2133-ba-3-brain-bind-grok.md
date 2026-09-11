# BA-3 — persist bot.brain execution bind

- **Date:** 2026-09-10
- **Agent:** grok (implemented on `ao/ba-3-brain-bind`, then merged)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/293 · merge commit `b6013f12d1fc625933ead6e16e6cc7997321da97`

## What landed

`bot.brain` execution bind on create/runtime config (`native_harness | allternit_cloud | uhp_harness`). Native harness start fail-closes if the harness/session is missing. BotHubCard brain chip; CommRails join via `brain.nativeSessionId`. `cleanup.sh` drops `commrails/target`. `brainId` remains Gizzi `/api/v1/brains`.

Persisted in `config.botBrain` (no new SQL column). Session start pickups the stored native session, or a tracked `bot-<id>-<harness>` id, or the only catalog session of that harness. Multiple catalog sessions refuse to guess.

## Verification

- Local: `bot-brain.test.ts` 14/14; create-bot wizard tests 31/31; bot-contract + commrails-store 16/16.
- GitHub Actions on #293: vitest, typecheck/build desktop, gitleaks, typography, SW cache bump — success. Vercel rate-limit and Pages Git previews ignored.

## Honest deferrals

- UHP mode stores `uhpHarnessId` only; no UHP spawn (BA-7).
- Native create still uses native-sessions pickup, not CLI spawn.
- ao-engine visibility HTTP still not built (BA-1 leftover).
- Desktop DMG not rebuilt.
- BA-5 policy, BA-6 computer-orgo, BA-8 `client.bots` not started.
- Do not steal worktree `allternit-ao-allternit-runtime-api`.
