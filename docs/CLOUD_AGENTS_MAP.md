# Cloud Agents — gap map (Phase 1 done, Phase 2 this handoff)

Orchestrator-owned. Executor: do not invent product names or a second agent table.

## Product (locked)

**Allternit Agents** = one product, two specialties:

- **Cloud Agents** (this work): API sessions. `POST /api/v1/sessions`.
- **Bot Agents**: existing Bot contract. Do not rebuild. Do not add `/runtimes`.

Do **not** call the product “Allternit Runtime”. Completions/Responses (`agents_v1_routes.rs`) stay Layer A — **do not change**.

SDK: `new Allternit({ apiKey, baseURL })` — class name **`Allternit`**.

## Phase 1 (already on this branch / PR #274)

Public `/api/v1/sessions` facade over `beta_sessions`. Inline agent, `computer.kind` none/local/sandbox-400, Allternit event names, agent version+archive, TS+Python clients, V140.

Known Phase 1 hole (this Phase 2): a session with `input` stays public `running` until `user.interrupt`, because nobody writes `turn.completed` / `session.idle` when the work task finishes.

## Phase 2 target (this handoff only)

Close the lifecycle. A Cloud Agent session whose work task is acked returns to `idle` and the public event list shows `turn.completed` then `session.idle`. Turns are listable.

### Work-task → events

Hook **existing** `/beta/work` completion. Do not invent a second worker protocol.

| Worker call | Stored events (legacy snake_case, same as Phase 1) | Public types |
|---|---|---|
| `POST /beta/work/:id/ack` (success) | `turn_completed`, `session_idle` | `turn.completed`, `session.idle` |
| `POST /beta/work/:id/stop` (cancel/fail) | `turn_failed`, `session_idle` | `turn.failed`, `session.idle` |

Rules:

- Only emit if the task has a `session_id`. Skip bare work-queue tasks.
- Skip if the session is already `archived`.
- After `user.interrupt` the tasks are already `cancelled`. If `stop`/`ack` then finds a cancelled/terminal row and does not update, emit nothing extra.
- Do **not** write stored status `idle`/`failed` onto `beta_sessions` (CHECK is still `active|archived`). Public status stays derived: no in-flight work → `idle`.
- Put a small helper next to `insert_event` in `beta_session_routes.rs` (e.g. `pub(crate) fn emit_turn_terminal(conn, session_id, outcome: &str, data: &Value)`). Call it from `ack_task` and `stop_task` in `beta_work_routes.rs` after a successful row update. Load `session_id` from the task row.
- `outcome` is `"completed"` or `"failed"` only.

### Translate (add to `translate_event` in `cloud_agents_routes.rs`)

| stored | public |
|---|---|
| `turn_completed` | `turn.completed` |
| `turn_failed` | `turn.failed` |
| `session_idle` | `session.idle` |
| `session_failed` | `session.failed` (map it; Phase 2 does not have to write this stored type) |

Keep existing Phase 1 mappings (`session_created`, `computer_*`, `run_requested`, `user_interrupt`, `tool_calls`). Dual `run_requested` public ids stay suffixed (`{id}:turn.started`, `{id}:session.running`).

### `GET /sessions/:id/turns`

New route on `cloud_agents_router`. Auth same as other session routes (`load_session` first).

Build turns from the **public** event stream of that session, in order:

- `turn.started` opens a turn (`status: "running"`, `started_at` from that event).
- `turn.completed` closes it (`status: "completed"`, `completed_at`).
- `turn.failed` closes it (`status: "failed"`, `completed_at`).
- `id` of the turn = the `turn.started` event id (the public id, including the `:turn.started` suffix if present).

Response: `{ "turns": [ { "id", "status", "started_at", "completed_at" } ] }` oldest-first. Empty list if none. No pagination this phase.

### SDK

- TS `Allternit.sessions.turns.list(sessionId)` → GET `/api/v1/sessions/:id/turns`.
- Python `client.sessions.turns(session_id)` same. Do not break `Harness`.

### Docs

Update `docs/public/api/sessions.md`: a run ends when the work task is acked; public status becomes `idle`; `GET /sessions/:id/turns`. Register 1. No guarantees. No “drop-in OpenAI”.

Do **not** rewrite `docs/public/api/agents.md` except a one-line pointer at turns if it already mentions events.

## Files to change

- `cmd/allternit-api/src/beta_session_routes.rs` — `emit_turn_terminal` helper next to `insert_event`
- `cmd/allternit-api/src/beta_work_routes.rs` — call it from `ack_task` and `stop_task`
- `cmd/allternit-api/src/cloud_agents_routes.rs` — translate + `GET /sessions/:id/turns` + tests
- `sdk/allternit-sdk/src/ai-runtime/cloud-agents/client.ts` (+ types if needed)
- `sdk/allternit-python/src/allternit/sessions.py`
- `docs/public/api/sessions.md`

No new migration unless you truly cannot read `session_id` off `beta_work_tasks` (you can; the column exists).

## Tests (in-module, same style as Phase 1)

At least:

1. Create Cloud session with inline agent + `kind=none` + `input` → public `running`. Lease+ack the `beta_work_tasks` row via the beta work router (merge `beta_work_router()` in the test app). GET session → `idle`. GET events include `turn.completed` and `session.idle`. GET `/turns` → one turn `completed`.
2. Create + input, then `user.interrupt` → `idle`; GET `/turns` may still show a running or failed turn depending on whether interrupt emits `turn.failed`. **Locked:** interrupt does **not** require a `turn.failed` event this phase (Phase 1 already records `user.interrupt` and cancels tasks). Turns list may show a still-`running` turn after interrupt; that is acceptable. Do not spend time inventing interrupt→turn.failed unless it falls out of the stop hook.
3. Beta alias still 201/200 (keep the existing test working).
4. Translation: stored `turn_completed` → public `turn.completed`.

If lease+ack is too awkward in-process, you MAY call `emit_turn_terminal` from the test with a real DB connection after create (the helper is the contract). Prefer going through `ack_task` if the beta test fixtures make it easy.

## Do not (Phase 2)

- Sandbox entitlement / hosted-runtime provision / `computer.kind: fabric|desktop` workers
- Vaults, brains column, schedules, tool_search, MCP, permission policies
- Session dollar budget (money-adjacent — parked)
- OpenAI/Anthropic wrap or public `/runtimes`
- Completions/Responses edits
- Bot Agents / CommRails / crate rename
- Docker, Stripe, deploys, git commits/pushes
- cargo/tsc as a required done step
- Phase 3

## Voice (docs only)

Plain, direct. No hype, no guarantees, no “compatible with OpenAI Agents API”.
