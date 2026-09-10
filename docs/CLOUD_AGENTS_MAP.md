# Cloud Agents Phase 1 — gap map

Orchestrator-owned. Executor: do not invent product names or a second agent table.

## Product (locked)

**Allternit Agents** = one product, two specialties:

- **Cloud Agents** (this phase): API sessions. `POST /api/v1/sessions`.
- **Bot Agents**: existing Bot contract. Do not rebuild. Do not add `/runtimes` as a public resource.

Do **not** call the product “Allternit Runtime”. `hosted-runtime` is infra only.

Layer A (do not touch except docs mention):

- Completions: `/api/agents/v1/chat/completions`
- Responses: `/api/agents/v1/responses`

Layer C (this phase): Cloud Agents sessions.

SDK: `new Allternit({ apiKey, baseURL })` — not `OpenAI`, not `beta.agents`.

## What exists

| Piece | Path | Notes |
|---|---|---|
| Agent CRUD | `cmd/allternit-api/src/agent_routes.rs` mounted `/api/v1/agents` | SQLite `agents` table (`V1__baseline_schema.sql`). Columns: id, user_id, name, system_prompt, model, provider, tools, config, status (`idle` default). **No `version` column. No archive route.** |
| Durable sessions | `cmd/allternit-api/src/beta_session_routes.rs` | `/api/v1/beta/sessions`. Table `beta_sessions`. Status today: `active` (implied default) and `archived`. Events: `session_created`, `budget_updated`, `session_archived`, `user_interrupt`, run events. SSE `/events`, WS `/events/ws`, POST `/run` enqueues `/beta/work`. |
| Completions/Responses | `agents_v1_routes.rs` | **Do not change.** |
| Computers | `computer_routes.rs` `/api/v1/computers` | Bot desktops. Do not collide. Phase 1 Cloud Agent `computer.kind` is stored on the **session**, not a new computers row, except `sandbox` may call existing hosted-runtime provision if entitlement exists. |
| SDK | `sdk/allternit-sdk` | `AllternitHarness`, `AllternitAgent`, `RemoteAgentsClient` → `/api/agents/v1/*`. No Cloud Agents client. |
| Python | `sdk/allternit-python` | `Harness` only. |
| Docs | `docs/public/api/sessions.md` | Documents `/beta/sessions` only. |
| Mount | `cmd/allternit-api/src/main.rs` ~638 | `v1_routes.merge(beta_session_router())` nested under `/api/v1`. |

## Target public API (Phase 1)

All under `/api/v1` (already nested):

| Method | Path | Behavior |
|---|---|---|
| POST/GET | `/sessions` | Create/list Cloud Agent sessions |
| GET | `/sessions/:id` | Retrieve; public `status` mapped (below) |
| POST | `/sessions/:id/archive` **and** keep DELETE/PATCH on beta | Archive. Spec allows POST archive. Also keep existing DELETE-or-whatever beta uses (`delete(archive_session)` on `/beta/sessions/:id`). Public: `POST /sessions/:id/archive`. |
| GET | `/sessions/:id/events` | JSON list (paginated if list exists; otherwise full list like `/events/list`) |
| POST | `/sessions/:id/events` | Body `{ "events": [ { "type": "user.message"\|"user.interrupt"\|"user.tool_result", ... } ] }` |
| GET | `/sessions/:id/events/stream` | SSE of Allternit event types |
| POST | `/agents/:id/archive` | Archive agent (status archived / archived_at). No unarchive. |
| Agent version | `agents.version` integer | New column default 1; increment on config-changing PUT/POST update. Return `version` on agent JSON. |

Keep `/api/v1/beta/sessions` **working as alias** (same table). Old event type strings may still be stored; **public list/stream must emit Allternit types**.

### POST /sessions body

```json
{
  "agent": "agent_id" | { "id": "...", "version": 1 } | { "model": "...", "instructions": "...", "tools": [], "name": "optional" },
  "computer": { "kind": "none" | "sandbox" | "local" },
  "input": "string" | { "type": "user.message", "content": "..." },
  "stream": false,
  "vault_ids": [],
  "budget": { "max_tokens": 0, "max_turns": 0, "max_tool_calls": 0 },
  "metadata": {},
  "brain_id": null
}
```

- Inline agent: create a row in `agents` (name default `cloud-agent`, system_prompt from `instructions`). Bind `agent_id`.
- `computer.kind: none`: no sandbox. Session is valid. `computer.ready` event immediately (or omit computer events).
- `computer.kind: sandbox`: if hosted-runtime provision path exists **and** user has entitlement, call it and emit `computer.pending` then `computer.ready` or `computer.failed`. If not entitled / not wired: **400** with a clear error. **Do not** silently fall back to `none`.
- `computer.kind: local`: store kind on session; emit `computer.pending`. Do not wait for a worker in Phase 1. Session can still accept `user.message` (run queue). Document as “descriptor only this release”.
- `input` present: after create, treat as `user.message` (enqueue run like `POST /run`).
- `stream: true`: response is SSE of events from this session (same as GET stream), not a JSON session body. First events must include `session.created`.

Auth: existing Clerk/API-key middleware. Do not require `OpenAI-Beta`. Ignore that header if present.

### Public session status

| DB / internal | Public `status` |
|---|---|
| archived | `archived` |
| failed | `failed` |
| waiting (new) | `waiting` |
| active/running + in-flight work task | `running` |
| active + no in-flight work | `idle` |

Existing rows with `status='active'` must still list. Map them. New writes may use `idle|running|waiting|failed|archived`.

`user.interrupt` → public `idle` (keep row usable). Archived cannot send.

### Event types (public)

**Send:** `user.message`, `user.interrupt`, `user.tool_result`

**Persist/stream:** `session.created`, `session.running`, `session.idle`, `session.waiting`, `session.failed`, `computer.pending`, `computer.ready`, `computer.failed`, `turn.started`, `turn.completed`, `turn.failed`, `agent.message`, `agent.tool_use`, `agent.tool_result`

Each event JSON: `{ "id", "type", "session_id", "created_at", "data" }` (keep extra fields if table has sequence).

Translate stored legacy types on read:

| stored | public |
|---|---|
| `session_created` | `session.created` |
| `session_archived` | (status archived; may omit or pass through as session.idle — prefer omit extra) |
| `user_interrupt` | `user.interrupt` |
| `run_requested` / similar | `turn.started` + `session.running` |
| thinking/content deltas | `agent.message` (full) or skip deltas in Phase 1 JSON list; stream may emit `agent.message` when run completes |

Do **not** emit `agent.session.created` or other OpenAI names as `type`.

`user.message` handler: same as `POST /beta/sessions/:id/run` with `messages: [{role:user, content: text}]`. Set public status `running`, emit `session.running` + `turn.started`. When work task finishes (if you can observe it cheaply), emit `turn.completed` + `session.idle`. If the work queue stays `queued` with no worker, still emit `session.running` then allow interrupt back to `idle`. Do not hang the HTTP create.

## Files to add/change

- `cmd/allternit-api/src/cloud_agents_routes.rs` (new) — public `/sessions*` facade. Share DB helpers with beta (pub(crate) `load_session` / `insert_event` if needed; avoid copy-paste of the whole 2700-line file).
- `cmd/allternit-api/src/lib.rs` — `pub mod cloud_agents_routes;`
- `cmd/allternit-api/src/main.rs` — `.merge(cloud_agents_router())` on `v1_routes`
- `cmd/allternit-api/src/agent_routes.rs` — `version` column + archive
- New SQL migration next to existing `cmd/allternit-api/migrations/` — `agents.version INTEGER NOT NULL DEFAULT 1`, `agents.archived_at`, `beta_sessions.computer_kind`, `beta_sessions.computer_id` nullable. Follow existing migration numbering.
- `sdk/allternit-sdk/src/ai-runtime/cloud-agents/client.ts` + export from package (`@allternit/sdk/cloud-agents`). Class name **`Allternit`**. Methods: `sessions.create`, `sessions.retrieve`, `sessions.archive`, `sessions.events.send`, `sessions.events.stream` (async iterator of events). Under `src/ai-runtime/` so existing `tsconfig.ai-runtime.json` emits `dist/cloud-agents/`.
- `sdk/allternit-python/src/allternit/sessions.py` + export if it does not break `Harness`
- `docs/public/api/agents.md` — overview (Completions, Responses, Cloud Agents, Bot Agents). Register 1. No guarantees. No “drop-in OpenAI”.
- Graduate `docs/public/api/sessions.md` to document `/api/v1/sessions` and note `/beta/sessions` alias.
- Tests: extend `beta_session_routes.rs` tests or add `cloud_agents_routes` tests in the same style (in-module `#[cfg(test)]`). At least: create with inline agent + `computer.kind=none` + input; archive blocks send; interrupt; event type translation; beta alias still 201/200.

## Do not

- Wrap OpenAI/Anthropic hosted agent APIs
- Change `/api/agents/v1/chat/completions` or `/responses`
- Public `/runtimes` resource
- Rebuild Bot Agents / Create Bot
- Codex exec-server
- New Stripe SKU
- Docker
- Git commits / pushes (orchestrator owns git)
- cargo build / tsc as a required step (orchestrator may run later). You MAY add tests that compile with the existing test module pattern.
- Phase 2: fabric/desktop worker, outputs, vaults facade, brains attach, schedules, tool_search on the public agent object

## Voice (docs only)

Plain, direct. No “revolutionary”, no “10x”, no guaranteed results. “Same kind of product as hosted agent sessions” is allowed. “Compatible with OpenAI Agents API” is not.
