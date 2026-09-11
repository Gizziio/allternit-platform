# BA-3 — persist bot.brain execution bind

- **Date:** 2026-09-10
- **Agent:** grok (merge only; implementation was `ao/ba-3-brain-bind`)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/293 · merge commit `b6013f12d1fc625933ead6e16e6cc7997321da97`

## What landed

`bot.brain` execution bind on create/runtime config (`native_harness | allternit_cloud | uhp_harness`). Native harness start fail-closes if the harness/session is missing. BotHubCard brain chip; CommRails join via `brain.nativeSessionId`. `cleanup.sh` drops `commrails/target`. `brainId` remains Gizzi `/api/v1/brains`.

## Verification

GitHub Actions on #293: vitest, typecheck/build desktop, gitleaks, typography, SW cache bump — success. Vercel + Pages Git previews ignored.

## Honest deferrals

BA-3 follow-ups in the PR body if any; this attestation is merge-of-green-checks, not a re-review of the executor's tests.
