# Allternit Agents — shipped surface (2026-09-11)

Living map. Product name is **Allternit Agents**, not Runtime. Queue `rq-20260910-002` landed.

## Cloud Agents

`/api/v1/sessions` over `beta_sessions`. Completions/Responses at `/api/agents/v1/*` unchanged.

- Create/get/archive; events list/send/SSE
- Turns, threads, outputs (session files)
- `computer.kind`: `none` | `local` | `sandbox` (ephemeral Computer Cloud) | `desktop` | `fabric` (session-lived Computer Cloud). Bind `computer.id`.
- No VM driver → `503` `computer_unavailable` (fail-closed). Incus/Tart live on the VPS.
- `brain_id`, `vault_ids`, `bot_id`, `permission`, `parent_thread_id`
- `/api/v1/vaults`, `/api/v1/schedules`, `GET /agents/:id/toolset`
- Budget: caps + USD **telemetry** (`charged: false`)

SDK: `@allternit/sdk/cloud-agents` `Allternit`. Python `allternit.Allternit`.

## Bot Agents

Same `agents` table (`is_bot`). `Allternit.bots` + session `bot_id`. Persistent Computer Cloud desktop. CommRails, ao, ACI policy, `bot.brain`.

## Not this product

- OpenAI/Anthropic drop-in shims (`new OpenAI({ baseURL })`)
- Charging the USD telemetry (Stripe)
- Unit-test Incus/Tart (those run on the Computer Cloud VPS)
