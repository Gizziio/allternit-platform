---
status: done
files_changed:
  - cmd/allternit-api/src/cron_lite.rs
  - cmd/allternit-api/src/beta_deployment_routes.rs
  - cmd/allternit-api/src/beta_work_routes.rs
  - cmd/allternit-api/src/beta_memory_store_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/migrations/V41__beta_deployments.sql
  - cmd/allternit-api/migrations/V42__beta_work_queue.sql
  - cmd/allternit-api/migrations/V43__beta_memory_stores.sql
deviations:
  - Added deployment_id foreign-key validation in beta_work_routes::create_task; the original code only validated session_id. The error message now covers both references.
remaining:
  - No scheduler daemon currently fires deployments automatically on cron/next_run_at; only explicit POST /beta/deployments/:id/runs triggers a run and advances next_run_at.
  - beta/work reuses the end-user Clerk auth path; a dedicated worker credential type is needed for realistic self-hosted runners.
  - beta/memory-stores only scaffolds the store record and policy object; actual memory-content read/write and redaction enforcement are out of scope for this phase.
---

## What changed

All three Phase 2 scope items from `docs/SWARM_B_PHASE2_MAP.md` are implemented,
following the `beta_session_routes.rs` idiom (`Extension<AuthUser>`, `ApiError`,
`spawn_blocking` + rusqlite transactions, per-user scoping).

### 1. Scheduled deployments (`beta/deployments`)

- `cmd/allternit-api/src/cron_lite.rs` — minimal 5-field cron parser
  (`minute hour dom month dow`). Supports `*`, `*/step`, single values,
  `a-b` ranges, `a-b/step`, comma lists, and `0`/`7` for Sunday. Standard
  cron dom/dow union semantics when both are restricted. `next_run_after`
  searches up to 4 years ahead and returns an error for cron expressions
  that can never match (e.g. `0 0 30 2 *`). 11 unit tests.
- `cmd/allternit-api/src/beta_deployment_routes.rs` — CRUD at
  `/api/v1/beta/deployments` (create/list/get/patch/delete), plus
  `/api/v1/beta/deployments/:id/runs` (list run history, POST to trigger a
  run) and `/api/v1/beta/deployments/:id/runs/:run_id` (PATCH to report a
  terminal run status). `next_run_at` is computed on create, on cron/status
  change, and each time a run is triggered.
- Migration `V41__beta_deployments.sql` adds `beta_deployments` and
  `beta_deployment_runs` (FK cascade-deleted with the parent deployment).

### 2. Work queue / self-hosted sandbox protocol

- `cmd/allternit-api/src/beta_work_routes.rs` — implements and documents
  (module-level doc comment) the external worker poll protocol:
  `POST /api/v1/beta/work` to enqueue a task, `GET /api/v1/beta/work` to
  list, `GET /api/v1/beta/work/queue?worker_id=` to lease the oldest
  available task (including reclaiming tasks whose lease expired without a
  heartbeat — crash recovery), `POST /api/v1/beta/work/:id/heartbeat` to
  renew the lease and mark it `running`, `POST /api/v1/beta/work/:id/ack`
  to report success, and `POST /api/v1/beta/work/:id/stop` to cancel.
  Tasks optionally reference a `session_id` or `deployment_id` and carry a
  `payload` + `sandbox_image` + `env`. Both `session_id` and `deployment_id`
  are now validated against the owning user on create.
- Migration `V42__beta_work_queue.sql` adds `beta_work_tasks`.

### 3. Memory Stores API scaffold (`beta/memory-stores`)

- `cmd/allternit-api/src/beta_memory_store_routes.rs` — create/list/get/
  delete at `/api/v1/beta/memory-stores`, scoped to `user_id` with
  `organization_id` recorded from the authenticated caller. Each store has
  a `redaction_policy` object (opaque at this layer — enforcement is out of
  scope for the scaffold) and a `metadata` object. Names are unique per
  user; a duplicate name returns 400 rather than a raw DB constraint error.
- Migration `V43__beta_memory_stores.sql` adds `beta_memory_stores`.

### Wiring

All three routers are registered in `lib.rs` and merged into the `/api/v1`
route set in `main.rs`, right after `beta_session_router()`, so they inherit
the same Clerk auth middleware as the rest of the protected API.

### Tests added

Added DB-backed integration tests for the three new route modules:

- `beta_deployment_routes::tests::deployment_lifecycle_and_run_history`
- `beta_deployment_routes::tests::rejects_invalid_cron_and_unknown_status`
- `beta_work_routes::tests::work_queue_lease_heartbeat_ack_and_isolation`
- `beta_work_routes::tests::stop_releases_task_and_rejects_terminal_ack`
- `beta_work_routes::tests::rejects_missing_session_or_deployment_reference`
- `beta_memory_store_routes::tests::memory_store_crud_and_isolation`
- `beta_memory_store_routes::tests::rejects_invalid_store_input`
- `cron_lite::tests::validate_succeeds_for_valid_and_fails_for_invalid`
- `cron_lite::tests::range_with_step_and_list`

## Verification

- `cargo check -p allternit-api` — clean, no warnings from any new file.
- `cargo test -p allternit-api --lib` — 154 passed (was 145 before this
  work); all new and existing tests pass.

No dev servers, external services, or full test suites requiring a live DB
were run, per the phase constraints.

## Blockers / deviations

No blockers. The only deviation from the previous partial state was adding
`deployment_id` validation in `beta_work_routes::create_task` and expanding
the test coverage.

## Remaining for Phase 3

- Worker-specific authentication: `beta/work` currently reuses the same
  Clerk-authenticated `AuthUser` as the rest of the API (a self-hosted
  worker polls with the owning user's own credentials). A dedicated
  worker/runner credential type (distinct from end-user Clerk sessions,
  similar to the existing `allternit_git_` tokens or CLI access tokens)
  would be a more realistic self-hosted-runner auth story.
- No scheduler daemon actually fires deployments on their `cron`/
  `next_run_at` yet — `POST /beta/deployments/:id/runs` lets a caller (or a
  future scheduler loop) trigger a run and advances `next_run_at`, but
  nothing currently polls `beta_deployments` and calls it automatically.
- `beta/memory-stores` only scaffolds the store record and its
  `redaction_policy`/`metadata`; there is no memory-content read/write API
  or actual redaction enforcement yet.
