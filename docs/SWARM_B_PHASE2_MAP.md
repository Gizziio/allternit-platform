# Swarm B — Agent Runtime Foundation — Phase 2 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Scheduled deployments (`beta/deployments`)** — Add CRUD API at `/api/v1/beta/deployments` with fields: `agent_id`, `cron`, `next_run_at`, `last_run_at`, `status`. Compute `next_run_at` from a cron expression using a minimal parser (support `* * * * *` and common variants). Store deployment runs in a `beta_deployment_runs` table with status and history.

2. **Work queue / self-hosted sandbox protocol** — Document and implement the external worker poll protocol:
   - `GET /api/v1/beta/work/queue` for workers to lease a task.
   - `POST /api/v1/beta/work/:id/heartbeat` to keep a lease alive.
   - `POST /api/v1/beta/work/:id/ack` to mark success.
   - `POST /api/v1/beta/work/:id/stop` to cancel.
   Tasks are tied to sessions/deployments and carry a payload with sandbox image and env.

3. **Memory Stores API scaffold** — Add `beta/memory-stores` CRUD: create/list/get/delete memory stores scoped to a user/org, with a `redaction_policy` field.

## Known starting files
- `cmd/allternit-api/src/beta_session_routes.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/lib.rs`
- `cmd/allternit-api/migrations/`

## Constraints
- Do NOT start Phase 3 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p2-swarm-b`.
