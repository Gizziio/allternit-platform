# Cloud Agents — Phase 3 (brain attach + vaults alias)

Orchestrator-owned. Phase 1+2 are on main. This handoff only.

## Product (locked)

Allternit Agents / Cloud Agents. No `/runtimes`. Completions/Responses untouched. No Bot Agents. No dollar budget. No sandbox provision this phase.

## Phase 3 target

1. **Brain attach.** `brain_id` on `POST /sessions` is validated against `brains` (`id` + `user_id`). Stored on `beta_sessions.brain_id`. Returned on public session JSON. Unknown → `400`. Null/omitted → no bind.
2. **Vault ids.** `vault_ids` must be a JSON array of strings. Each id must exist in `allternit_vaults` with `created_by = user`. Unknown → `400`. Still stored in session metadata; also returned top-level `vault_ids` on public JSON.
3. **Vault facade.** `/api/v1/vaults` and `/api/v1/vaults/:id` are aliases of the existing `/beta/vaults` CRUD (same handlers). Credential subroutes stay on `/beta/vaults/...` this phase.

## Do not

Sandbox entitlement, fabric/desktop workers, schedules, tool_search, outputs, permission policies, dollar budget, OpenAI wrap, Completions/Responses, Bot Agents, git, Docker, Stripe.
