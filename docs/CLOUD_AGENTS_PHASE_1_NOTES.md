---
status: done
files_changed:
  - cmd/allternit-api/migrations/V140__cloud_agents.sql
  - cmd/allternit-api/src/cloud_agents_routes.rs
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/src/agent_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/client.ts
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/types.ts
  - sdk/allternit-sdk/src/ai-runtime/cloud-agents/index.ts
  - sdk/allternit-sdk/package.json
  - sdk/allternit-python/src/allternit/sessions.py
  - sdk/allternit-python/src/allternit/__init__.py
  - docs/public/api/agents.md
  - docs/public/api/sessions.md
  - .allternit/shared-context.md
deviations:
  - Stored session status stays in the legacy active/archived vocabulary instead of writing new idle/running/waiting values; public status is derived (active + in-flight work -> running, otherwise idle). This keeps every existing beta handler (which gates on status='active') working unchanged on rows created through either surface, and avoids a risky beta_sessions table rebuild to relax the V36 CHECK constraint. The MAP's public status table is fully honored; its "new writes may use idle|running|waiting" line is permissive, not required.
  - Sandbox computers return 400 unconditionally in this phase (no entitlement check is wired); the MAP allows "not entitled / not wired: 400".
  - SDK sources live under `src/ai-runtime/cloud-agents/` (reviewer move) so `tsc -p tsconfig.ai-runtime.json` emits `dist/cloud-agents/` matching the `./cloud-agents` package export. The MAP path `src/cloud-agents/` would not compile under the existing `rootDir`.
  - build/typecheck not run by the executor: task constraints forbid builds as a done step (orchestrator verifies).
remaining:
  - cargo check + cargo test -p allternit-api (new in-module tests in cloud_agents_routes.rs) and the TS/Python SDK compiles — deferred to the orchestrator per task constraints.
  - Sandbox entitlement wiring (hosted-runtime provision + computer.pending/computer.ready/computer.failed emission) is Phase 1+ work, gated on an entitlement source.
  - turn.completed / session.idle on run completion are emitted only when the work queue is observable; a worker-less queue stays running until user.interrupt, per the MAP.
brain_updates:
  - Allternit Agents product naming is now locked in code and docs: Cloud Agents = public /api/v1/sessions facade over the beta_sessions table; Bot Agents = existing contract; product is never "Allternit Runtime" publicly and there is no public /runtimes resource.
  - The public Cloud Agents surface derives idle/running from in-flight beta_work_tasks (queued/leased/running) rather than a stored status; user.interrupt cancels those tasks to return a session to idle.
---

# Cloud Agents Phase 1 — notes

## What was built

Public **Cloud Agents** API under `/api/v1`, product name **Allternit Agents**
(Cloud Agents specialty; Bot Agents untouched; no `/runtimes` resource; no
`OpenAI-Beta` header). It is a facade over the existing durable beta session
layer — same `beta_sessions`, `beta_session_events`, and `beta_work_tasks`
tables — so `/api/v1/beta/sessions` keeps working as an alias.

Routes (all merged into `v1_routes` in `main.rs`, nested under `/api/v1`,
behind the existing auth middleware):

- `POST/GET /sessions` — create (inline agent, existing id, or
  `{id, version}` ref) / list
- `GET /sessions/:id` — public status mapped (`idle|running|waiting|failed|archived`)
- `POST /sessions/:id/archive` — one-way archive; sends after archive fail 400
- `GET/POST /sessions/:id/events` — JSON list with Allternit event types /
  send `user.message`, `user.interrupt`, `user.tool_result`
- `GET /sessions/:id/events/stream` — SSE of public events, `?after=` cursor

Behavior highlights:

- Inline agent → real `agents` row (name default `cloud-agent`,
  `instructions` → `system_prompt`, provider `allternit`, version 1 via
  migration default), session bound via `agent_id`.
- `input` (string or `{type:"user.message", content}`) enqueues a
  `beta_work_tasks` row exactly like `POST /run`, so status reads `running`
  while queued; the create response is never blocked on a worker.
- `stream: true` on create returns the SSE stream replayed from sequence 0,
  so the first frames include `session.created`.
- `computer.kind`: `none` → valid session + public `computer.ready`;
  `local` → public `computer.pending`, descriptor only, events still accepted;
  `sandbox` → **400** (no silent downgrade to `none`). Stored types
  `computer_ready` / `computer_pending` / `computer_failed` are translated on
  read (reviewer: the first NOTES draft omitted this mapping; tests already
  required `computer.ready`).
- `user.interrupt` cancels queued/leased/running work tasks and records
  `user_interrupt`; the session then reads `idle`.
- `user.tool_result` is accepted and recorded (skipped by the public
  projection) for forward compatibility.
- Event translation on read: `session_created`→`session.created`,
  `run_requested`→`turn.started`+`session.running`,
  `user_interrupt`→`user.interrupt`, `tool_calls`→`agent.tool_use`;
  `session_archived`, budget/context bookkeeping, and token deltas are
  omitted. No OpenAI-style names are ever emitted.

## Agent changes (`agent_routes.rs`)

- `agents.version INTEGER NOT NULL DEFAULT 1` + `agents.archived_at` (V140).
- `AgentRow` now returns `version`; both SELECT sites updated.
- `PUT /agents/:id` increments `version` on every config-changing update.
- New `POST /agents/:id/archive` sets `status='archived'` + `archived_at`;
  no unarchive.

## Migration

`V140__cloud_agents.sql` — three `ALTER TABLE`s only (agents.version,
agents.archived_at, beta_sessions.computer_kind, beta_sessions.computer_id).
No table rebuild; see deviations for why the status CHECK was left alone.

## SDK

- TypeScript (`@allternit/sdk/cloud-agents`): `class Allternit` with
  `sessions.create / retrieve / archive` and `sessions.events.send / stream`
  (async iterator over SSE). ESM, mirrors `RemoteAgentsClient` idiom.
- Python (`allternit.Allternit`): stdlib-only client with the same resource
  shape; exported additively from `__init__.py` (Harness untouched).

## Docs

- `docs/public/api/agents.md` — overview: Completions, Responses, Cloud
  Agents, Bot Agents; Register 1; no guarantees; no "drop-in OpenAI" claim.
- `docs/public/api/sessions.md` — graduated to document `/api/v1/sessions`
  end-to-end with the beta alias noted.

## Tests

In-module `#[cfg(test)]` tests in `cloud_agents_routes.rs` (same style as the
beta tests, sharing the now-`pub(crate)` fixtures from
`beta_session_routes::tests`): create with inline agent + `kind=none` + input
(agent row + system_prompt + translated event order asserted),
sandbox-without-entitlement 400, archive blocks send, interrupt → idle,
legacy event translation, beta alias 201/200 on the same table.

## Verification status

Executor did not compile (task constraint). Orchestrator review:

- Mapped stored `computer_ready` / `computer_pending` / `computer_failed` to
  public types (tests already required `computer.ready`; NOTES draft had
  omitted the mapping). Dual `run_requested` events get distinct public ids.
- Moved SDK sources to `src/ai-runtime/cloud-agents/` so the existing
  `tsconfig.ai-runtime.json` emits `dist/cloud-agents/`.
- Fixed `list_cloud_events` / `send_cloud_events` move-after-use compile
  errors; test GET used `format!("{}", json_value)` which quoted the id.
- `cargo test -p allternit-api --lib cloud_agents_routes`: **7 passed**.
- Python `py_compile` and bun bundle of the TS client: ok.
- Completions/Responses (`agents_v1_routes.rs`) untouched. No `/runtimes`.
  No OpenAI/Anthropic wrap.
