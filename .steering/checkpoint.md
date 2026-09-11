# Steering checkpoint — session/console-be-p3

## Goal
Backend build-out Phase 3 (G6): deployment scheduler daemon in allternit-api — poll beta_deployments where next_run_at <= now, restart-safe claim, enqueue work task + insert beta_deployment_runs row, recompute next_run_at. Scheduler only creates runs; terminal status still via existing worker PATCH. Overdue policy: fire-once (documented).

## Just did
- G6 complete: V144 migration (triggered_by), shared insert_deployment_run_tx
  (run + deployment-tied work task) used by trigger_run (manual) and the new
  deployment_scheduler daemon; scheduler module with restart-safe claim,
  fire-once overdue policy, next-occurrence anchored to the DUE time;
  AppState.deployment_scheduler wired through all 21 constructors;
  monitor/system exposes {last_tick_at, runs_fired_total}.
- Verified: cargo test -p allternit-api → 918 passed, 5 failed (exactly the
  known pre-existing agent_cloud×4 + rails gate×1). Live smoke on scratch
  port 18099: cron */1 fired at the minute boundary, run row
  (triggered_by=scheduler) + queued work task created, next_run_at advanced
  to the next minute (due-anchored), fire-once confirmed, monitor fields
  present. release-preflight 35/0.

## Next
- Parent review; commit/PR/attest/cleanup per repo ritual (not done here —
  session scoped to implementation + verification only).

## Open questions
- (resolved during impl) trigger_run did NOT enqueue a work task today and
  beta_deployment_runs had no triggered_by column. Followed the task's
  shared-function instruction: both paths now insert run + work task;
  triggered_by added via V144. Manual trigger response shape unchanged
  apart from the additive triggered_by field.
- Interval env: DEPLOYMENT_SCHEDULER_INTERVAL_SECS, default 15s.
- Overdue reconciliation: next computed after the DUE time (no per-tick
  drift); if that next is still <= now (multiple missed occurrences), fall
  back to next after now so catch-up still fires exactly once.
- Work-task payload for deployment runs: {"deployment_run_id", "agent_id",
  "messages": [], "tools": null} — mirrors the session-run convention;
  messages empty because a scheduled run carries no prompt.
