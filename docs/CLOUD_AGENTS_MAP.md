# Cloud Agents — Phase 4 (remaining leftovers)

Orchestrator-owned. Phases 1–3 are on main.

## In this phase

| Leftover | What we ship |
|---|---|
| Threads | `GET /sessions/:id/threads` = child sessions (`parent_thread_id`). Create accepts `parent_thread_id`. |
| Outputs | `GET /sessions/:id/outputs` lists `session_files` (there is no `/workspace/outputs` route). |
| Schedules | `/api/v1/schedules` aliases `/beta/deployments` CRUD + runs. |
| Toolset | `GET /agents/:id/toolset` from existing agent columns. `tool_search`/`mcp` are `false`/`[]` until a later bind. |
| Permission | Session create `permission`: `always_allow` \| `always_ask` \| `auto`. Stored in metadata, returned on public JSON. Not enforced (ACI is Bot). |
| fabric/desktop | `400`, never silent `none`. Same contract as sandbox this release. |

## Parked / not this PR

- Session dollar budget (money-adjacent)
- Sandbox/Fly hosted-runtime provision (credits/org; still 400)
- Bot Agents BA-*
- OpenAI/Anthropic compat shims
