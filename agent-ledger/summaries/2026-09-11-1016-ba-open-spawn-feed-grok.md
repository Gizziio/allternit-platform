# Native/UHP spawn + subagent feed + computer drag

- **Date:** 2026-09-11
- **Agent:** grok (implemented + merged)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/300 · merge commit `e8377268aaea6866fa31edb14f8eddd8e13fed55`

## What landed

Native `bot.brain` create spawns the CLI (`POST /api/v1/native-sessions/spawn`) instead of stealing a catalog session. UHP mode POSTs `/v1/responses` on `ao serve`. Watch strip merges `GET /agents/:id/subagents` into the parent→child tree from #299. Ledger `subagent.spawned` includes `parent_agent_id`. `dragComputer` / `ComputersClient.sendDrag` close the BA-6 control-surface leftover.

## Verification

- Local: bot-brain + subagent-feed + subagent-tree 21/21; `native_spawn_tests` 1/1
- GitHub Actions on #300: vitest, typecheck/build desktop, gitleaks, typography, SW cache bump — success. Vercel/Pages ignored.

## Honest deferrals

- Kimi has no headless spawn (fail-closed; start Kimi then retry).
- Live Incus/Tart driver still 503 in unit tests (BA-6 create-without-bot_id already on main).
- UHP spawn needs `ao serve` + `UHP_TOKEN`.
