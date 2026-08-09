# Swarm B — Phase 4 Docs / GTM Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-b`  
**Branch:** `ao/p4-swarm-b`  
**Base:** `parity/swarm-sprint`

## Goal
Document the agent runtime, session lifecycle, memory, and deployment APIs built in Phases 0–3.

## Deliverables (all under `docs/public/` unless noted)

1. `docs/public/api/sessions.md` — CRUD for `/api/v1/beta/sessions`:
   - create, list, archive, update
   - per-session agent overrides
   - seeded initial events
   - `parent_thread_id` for child threads

2. `docs/public/api/events.md` — event streaming:
   - SSE endpoint `/beta/sessions/:id/events`
   - WebSocket endpoint `/beta/sessions/:id/events/ws`
   - Standard run event types (`message`, `tool_call`, `tool_result`, `budget_exceeded`, `done`, `interrupt`)
   - `POST /beta/sessions/:id/interrupt`

3. `docs/public/api/deployments.md` — `/beta/deployments` CRUD + run history + cron scheduling.

4. `docs/public/api/work-queue.md` — `/beta/work` lease/heartbeat/ack/stop protocol for self-hosted workers.

5. `docs/public/api/memory-stores.md` — `/beta/memory-stores` CRUD + memory versions + redaction.

6. `docs/public/guides/agent-lifecycle.md` — end-to-end guide: create agent → create session → stream events → interrupt → deploy on cron.

7. `docs/public/guides/token-turn-tool-budgets.md` — explain budget controls and `budget_exceeded` events.

## Validation
- `cargo check -p allternit-api` must pass.
- `cargo test -p allternit-api --lib` must still pass.
- Every doc file has H1 and runnable examples.

## Commit
Commit on `ao/p4-swarm-b` with message: `docs(p4): Swarm B agent runtime, sessions, memory, and deployments guides`.
