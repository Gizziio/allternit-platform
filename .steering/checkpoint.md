# Steering checkpoint — session/test-flake-fixes

**Goal:** Fix the three pre-existing test problems flagged in the console backend program's final report: (1) `deployment_scheduler::claim_race_fires_exactly_one_run` wall-clock flake, (2) `aci_routes::policy_seat_tests::audit_api_returns_rows_with_bot_filter` env-var race, (3) cloud-api `tests/common` harness breakage (32 tests, empty-schema vs public-DDL).

**Just did:**
- Fix 1 (deployment_scheduler.rs `claim_race_fires_exactly_one_run`): second tick is now anchored to `first[0].next_run_at - 1s` instead of `now + 5s`, which crossed minute boundaries when the test started in the last seconds of a minute (cron `* * * * *`).
- Fix 2 (aci_routes.rs `snapshot_throttle_writes_immediately_when_due_and_on_done`): this was the ONLY test mutating `ALLTERNIT_COMPUTER_USE_DIR` without `POLICY_TEST_LOCK`; policy-seat tests (incl. the audit API) read that var at request time. Now takes the lock and restores the prior value instead of `remove_var`.
- Fix 3 (cloud-api tests/common/mod.rs): root cause = migrations_pg DDL is entirely `public.`-qualified (pg_dump style), so enum types live in `public`, but the harness set `search_path TO <it_schema>` only → unqualified `$1::runmode` casts failed with `type "runmode" does not exist` (500s on all 32 tests). Fix: `SET search_path TO <schema>, public`.

**Next:** Verify — full `cargo test -p allternit-api` + `-p allternit-cloud-api`, repeated flake-target runs, `node scripts/release-preflight.mjs`, then PR/merge/attest/cleanup per ritual.

**Open questions:** Whether the 32 shared-table integration tests show cross-test pollution once the 500s clear (assertions look defensive: `>=` counts, per-id lookups).

---

**Update (subagent, cloud-api i32→i64 decode fix):**
- **Did:** Converted the DDL-backing `i32` model fields to `i64` in `cmd/allternit-cloud-api/src/db/cowork_models.rs` (Run/RunSummary steps, Job+QueuedJob, Schedule+ScheduleSummary counts, Task/TaskResponse/Create/UpdateTaskRequest priority, TaskQueueEntry retries). plan_tiers/user_runtime_quotas were already i64. Also fixed three latent MySQL-style `?` placeholder bugs that 500'd on Postgres: `run_service::list` (exercised by test_run_list), `task_service::list_tasks` (same class, unexercised), and a `?` in `tests/integration_tests.rs::test_run_pause_resume` raw SQL. Constant/NULL binds into bigint columns updated to i64 in routes/jobs.rs + executor_service.rs.
- **Verify:** `cargo check -p allternit-cloud-api --all-targets` clean (only pre-existing warnings). integration_tests 32/32 on two consecutive runs; cost_params 1/1; billing_webhook_grants 3/3. No cross-test pollution observed.
