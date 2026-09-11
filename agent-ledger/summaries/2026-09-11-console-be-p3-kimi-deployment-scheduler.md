# Attestation — session/console-be-p3 (console backend phase 3)

**Date:** 2026-09-11
**Agent:** kimi-code
**PR:** #363 (merge `3a2c023e3`)
**Topic:** Deployment scheduler daemon — cron-bound agents actually fire

## What was done
- `deployment_scheduler.rs`: tokio task spawned in main.rs (pattern: fabric background loops; batch worker has no shutdown handle). Poll `beta_deployments` every 15s (`DEPLOYMENT_SCHEDULER_INTERVAL_SECS`, clamped 1–3600, junk→default). One SQLite transaction per tick: select due active rows → restart-safe claim (`UPDATE … WHERE next_run_at=expected`, skip on 0 rows) → insert run row + enqueue work task → advance next_run_at. Fire-once overdue policy, next occurrence anchored to DUE time. Scheduler creates runs only; terminal status stays with worker PATCH. Info log per fired run.
- `trigger_run` previously created orphan `running` rows and enqueued nothing. Extracted `insert_deployment_run_tx` shared by manual trigger + scheduler; manual triggers now enqueue a work task (additive `triggered_by: "manual"`).
- V144: `beta_deployment_runs.triggered_by`.
- `GET /api/v1/monitor/system` exposes `deployment_scheduler {last_tick_at, runs_fired_total}`.

## Verification
- 8 new unit tests (due-fires, claim race→one run, guard loses when moved, not-due skip, 3h overdue fires once, due-anchored next, paused/archived never fire, interval parse). Full suite 918 passed / 5 failed = exactly the 5 known pre-existing env failures.
- Live smoke (5s interval): 18:18:03 fired for 18:18:00 due; run + queued work task; next_run_at 18:19 (due-anchored); monitor fields present; +20s still exactly 1 run.
- release-preflight 35 passed, 0 failed.

## Incidents / deviations
- Work-task payload follows session-run convention `{deployment_run_id, agent_id, messages: [], tools: null}` — no prior deployment payload existed to mirror; scheduled runs carry no prompt.
- cron_lite is 5-field minute granularity only.
- Main moved during the session (checkpoint.md conflict only; resolved keeping this session's; code auto-merged clean).
- AppState: 21 constructors updated (mechanical one-liner).

## Honest deferrals
- Phases 4–10 remain.
