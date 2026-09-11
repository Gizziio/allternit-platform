# Native/UHP spawn + subagent feed + computer drag

- **Date:** 2026-09-11
- **Agent:** grok (implemented + merged)
- **PR:** https://github.com/Gizziio/allternit-platform/pull/300 · merge commit `e8377268aaea6866fa31edb14f8eddd8e13fed55`

## What landed

Native `bot.brain` create spawns the CLI (`POST /api/v1/native-sessions/spawn`) instead of stealing a catalog session. UHP mode POSTs `/v1/responses` on `ao serve`. Watch strip merges `GET /agents/:id/subagents` into the parent→child tree from #299. Ledger `subagent.spawned` includes `parent_agent_id`. `dragComputer` / `ComputersClient.sendDrag` close the BA-6 control-surface leftover.

## Verification

- Local: bot-brain + subagent-feed + subagent-tree 21/21; `native_spawn_tests` 1/1
- GitHub Actions on #300: vitest, typecheck/build desktop, gitleaks, typography, SW cache bump — success. Vercel/Pages ignored.

## Honest deferrals (environmental — not missing code)

This Bot Agents thread is done. Left on the machine, not in the tree:

1. **Kimi headless spawn** — `kimi -p` refuses autonomous flags. Fail-closed: start Kimi, then retry. Codex/Claude spawn via `POST /api/v1/native-sessions/spawn`.
2. **Live Incus/Tart driver** — create without `bot_id` and Tart `local` are in the API; unit tests return 503 without a configured driver.
3. **UHP spawn** — code POSTs `/v1/responses` to `ao serve` (`127.0.0.1:8410`). Needs the process running and `UHP_TOKEN`.
