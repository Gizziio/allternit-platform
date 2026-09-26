# 2026-09-26 ~09:55 — session/subsfab-p4 — subscription-fabric P4 (router, pools, observability, catalog)

Agent family: kimi-code (orchestrator) + kimi --yolo executor in tmux (ao-subsfab-p4).
Merged: PR #753 → `3972626cb` (merge commit). Branch `session/subsfab-p4` (deleted after merge).

## What was done

Plan phase P4 of `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md`, both halves:

**Phase 1 — real capability router + quota pools** (`ef33e5ee7`, reviewer fixup `047f5a770`):
- `services/subscription-gateway/src/router/resolve.ts` — `FabricRouter` replaces the P1 static stub.
  Pure/deterministic `resolve(task, snapshot)` per REVIEW_CLAUDE §A2; every (manifest, account) pair
  lands in a candidate or `rejected[]` with a specific reason; policy re-checked per hop.
  §A4 literal: unknown pools eligible (below available/estimated, above worse-cost lanes), degraded
  serves interactive+normal / skips background, model_downgraded = exhausted for reasoning-class
  tasks until reset_at, local-budget breach demotes (never excludes), sensitivity default-deny,
  metered requires policy+task dual opt-in with approval threshold. `onAttemptFailed` stop classes
  include `content_refused` (no refusal shopping) and `submission_ambiguous` (never double-submit).
- `src/pools.ts` — pool state machine: cooldown ladder 30m→1h→2h→4h doubling, cap 24h; lazy expiry
  to `unknown` never `available`; no active probing; success after cooldown is the one trusted
  recovery (soft-signal `degraded` deliberately preserved). `src/breakers.ts` — per-adapter-version
  circuit breaker (>3 consecutive ui-change failures → `ui_drift`; closes only on probe pass).
- Wiring: `router/snapshot.ts` + `router/dispatch.ts` (resolve at enqueue via POST /v1/tasks,
  re-resolve per failure hop), worker feeds quota signals/pools/breakers at the failure boundary,
  `/v1/capabilities` gains per-account entitlements. Migration 0002 (`quota_pool_meta`,
  `adapter_breakers`).

**Phase 2 — observability + D13 subs model catalog** (`00fb3e725`, `ecbdbd3c5`):
- `src/catalog/subs_models.ts` + `GET /v1/catalog` — `subs/<provider>:<model_class>` picker entries,
  pure derivation from the Phase 1 snapshot (no second assembly path), zero provider literals
  (provider ids are opaque brands, formatted never matched). Shape parity with
  `available_model_catalog()` in cmd/allternit-api; entries appear only for `ready|degraded`
  health (hidden otherwise); each entry's `fabric` block carries capability + `options.model_class`.
- `src/observability/stats.ts` + `GET /v1/stats/adapters|rejections` (scoped `tasks:read`) —
  per-adapter success rate, median/p95 latency (nearest-rank), failures by class, breaker state;
  durable rejection history via migration 0003 (`route_rejections`) written at every
  route-decision persistence call site.
- CLI (`cmd/cli`): `allternit subs models`; `allternit subs status` extended with pools +
  adapter stats (fail-soft against older gateways).

## Verification evidence (orchestrator re-run, not executor claims)

- `pnpm -F subscription-gateway build` clean; `CI=1 pnpm -F subscription-gateway test` — **221/25 files** (P3 baseline 128).
- `cd cmd/cli && pnpm typecheck` clean; `CI=1 pnpm -F @allternit/cli test` — **48** (baseline 44).
- Provider-literal grep (`chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic`): gateway `src/`
  minus `src/adapters/` and the whole P4 diff incl. CLI — **no matches** (HARDENING §6 gate green).
- Scope: only `services/subscription-gateway/`, `cmd/cli/`, `docs/specs/subscription-fabric/p4/`.
- Reviewer fixup: `047f5a770` strips 2 NUL bytes left by the executor's Write (binary-diff artifact);
  stripped file hash-verified identical to the committed blob minus NULs; build+tests re-run green after.

## Incidents / honest deferrals

- Executor's Write embedded NUL bytes into resolve.ts (silent binary-diff); caught in review, fixed.
  Worth watching for in future executor output (`file <new-source>` if a diff shows "Bin").
- Repo commit-gate (steering consult) takes ~3 min per commit inside worktrees — executor phases
  appear stalled at `git commit` but are not.
- Breaker→health mapping is provider-granular (per-adapter drift health is a contract change, later phase).
- Rust-side picker merge (gateway catalog → /api/v1/models) deferred; shape parity is in place.
- `prefer`/`force` routing pins skip policy re-check at enqueue (explicit user pins, documented).
- Contract gaps worked around gateway-locally (manifest `lane`, task `requested_model_class`,
  health probe-passed marker, pool rung/window fields) — full list in P4_PHASE_1_NOTES.md §Contract workarounds.
- Full plan-doc P4 verify list is code-checked in tests (router ranking/degraded/ladder/breaker/
  sensitivity/rejected[]/model_downgraded/catalog health gating/model_class mapping).
