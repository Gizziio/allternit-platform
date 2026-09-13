# Session attestation — session/test-flake-fixes (2026-09-12)

**PR:** #440 (merge `a86c25796`) — `fix(tests): de-flake the three flagged pre-existing test problems`
**Scope:** The three pre-existing test problems flagged in the console-backend program's final report. All three fixed, verified, merged.

## What was done

### 1. `deployment_scheduler::claim_race_fires_exactly_one_run` wall-clock flake (cmd/allternit-api)

The second tick ran at `now + 5s`. With cron `* * * * *`, when the test started in the last ~5 seconds of a minute, the first tick's newly computed `next_run_at` (top of the next minute) was already ≤ `now + 5s`, so the second tick fired a second run and the `count_rows == 1` assertion flaked. Fix: anchor the re-tick to `first[0].next_run_at - Duration::seconds(1)` — strictly inside the claimed window by construction, wall-clock-phase independent. Verified 6/6 consecutive runs (12s apart, crossing minute boundaries).

### 2. `aci_routes::policy_seat_tests::audit_api_returns_rows_with_bot_filter` env-var race (cmd/allternit-api)

Root cause: `snapshot_throttle_writes_immediately_when_due_and_on_done` (aci_routes.rs) was the **only** test in the crate mutating `ALLTERNIT_COMPUTER_USE_DIR` without holding `policy_config::POLICY_TEST_LOCK`. The policy-audit HTTP handler resolves the audit log path from that env var **at request time** (`policy_audit::read_rows` → `aci_approvals::computer_use_dir()`), so while the audit test held its own temp dir under the lock, the snapshot test concurrently flipped the var (and `remove_var`'d it, falling back to `~/.allternit/computer-use`) mid-request. Fix: take `POLICY_TEST_LOCK` in the snapshot test and restore the prior value instead of `remove_var`. aci test module: 64/64 ×3 runs.

### 3. cloud-api `tests/common` harness — all 32 integration_tests 500'd (cmd/allternit-cloud-api)

Three stacked causes, all pre-existing on main:

- **search_path:** the harness scoped each run to a fresh `it_<uuid>` schema via `SET search_path TO <schema>`, but `migrations_pg/*.sql` DDL is entirely `public.`-qualified (pg_dump style), so enum types land in `public`. App queries cast `$1::runmode` unqualified → `type "runmode" does not exist` → 500 DATABASE_ERROR on every first request. Fix: `SET search_path TO <schema>, public` (schema first, so `_sqlx_migrations` bookkeeping stays isolated).
- **i32/i64 model drift (latent main bug, not test-only):** `001_initial.sql` creates `runs.total_steps/completed_steps`, `jobs.priority/queue_position/exit_code/retry_count/max_retries`, `schedules.run_count/misfire_count`, `task_queue.retry_count/max_retries`, `tasks.priority` as `bigint` (002 reaffirms for drifted DBs), but `cowork_models.rs` decoded them as `i32` → `INT4/INT8` decode 500s against any fresh DB. Converted `Run`, `RunSummary`, `Job`, `QueuedJob`, `Schedule`, `ScheduleSummary`, `Task`, `TaskQueueEntry` and the request/DTO structs (`TaskResponse`, `CreateTaskRequest`, `UpdateTaskRequest`, `CreateJobRequest`, `FailJobRequest`) to `i64`/`Option<i64>`. plan_tiers/user_runtime_quotas models were already `i64`. `TaskListFilter.priority_min/max` intentionally left `i32` (int4 binds against bigint columns are legal). JSON wire shape unchanged.
- **MySQL-style `?` placeholders (latent):** `run_service::list()` built optional WHERE conditions with `?` while appending `LIMIT $1 OFFSET $2` — Postgres syntax error on any filtered list (the list route always sets `tenant_id`, so every list 500'd). `task_service::list_tasks()` had the identical bug plus wrong `$1/$2` numbering. Both rewritten with numbered `$n` placeholders in bind order. `tests/integration_tests.rs` also had one raw `?` → `$1`.
- Also fixed `executor_service.rs` `TEST_DDL` (hand-rolled per-test tables) `INTEGER` → `BIGINT` for the widened columns to match 001/002 — required after the model conversion.

## Verification evidence

- `cargo test -p allternit-api`: **1042 passed, 5 failed** — failures are exactly the known pre-existing environment-only set (4× `agent_cloud_routes::*_through_real_os_control_plane` needing the `allternitos_control_plane` binary + 1× `rails::gate_data_plane_round_trip`), identical to main's baseline. Both previously-flaky tests pass (claim_race 6/6 across minute boundaries; aci module 64/64 ×3).
- `cargo test -p allternit-cloud-api --test integration_tests`: **32/32**, three consecutive runs, no order-dependence.
- `cargo test -p allternit-cloud-api --lib`: 294 passed, 1 failed = `contabo_runtime_service::provision_creates_container_and_instance_record`, pre-existing docker-env failure (no docker binary on this host; fails on main too).
- `cost_params` 1/1, `billing_webhook_grants` 3/3.
- `node scripts/release-preflight.mjs`: **35 passed, 0 failed**.

## Honest notes

- No shipped allternit-api behavior changed — both diffs are inside `#[cfg(test)]` modules, so the desktop-bundled binary is byte-identical; the step-8 desktop rebuild was skipped for that reason.
- cloud-api is not desktop-bundled; its decode-type change (i32→i64) is covered end-to-end by the 32 integration tests against a real Postgres.
- The docker-env contabo test and the 5 allternit-api env failures remain documented as environment-only; they were not in scope.
- The shared public-schema tables used by the cloud-api integration tests (all migrations are `public.`-qualified, so per-test-schema isolation only covers bookkeeping) are tolerated by these 32 tests by design — assertions are defensive (`>=` counts, per-id lookups). A future harness v2 could namespace the DDL itself.
