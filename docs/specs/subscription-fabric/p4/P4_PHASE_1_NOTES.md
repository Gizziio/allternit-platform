# P4 Phase 1 — NOTES (Real Router + Quota Pools)

Date: 2026-09-26. Branch: `session/subsfab-p4` (worktree, cut from main @ 16b0d96e2).
Scope: `services/subscription-gateway/` only (+ this `docs/specs/subscription-fabric/p4/` folder).

## What was built

### `src/router/resolve.ts` — `FabricRouter implements CapabilityRouter` (replaced the static stub)

- Pure/deterministic: constructor takes `{ now?, idGen?, policy? }` (defaults: real clock, `randomUUID`, `DEFAULT_ROUTING_POLICY`). No I/O, no ambient clocks, stable sort — no `Math.random`.
- `RoutingPolicy` (gateway-local): `version` (`p4-v1`), `allow_metered`, `metered_approval_threshold_usd`, `metered_default_est_usd`, `model_class_rank` (`fast/standard/reasoning/deep` → 0–3, so "reasoning ≥ X" is data), `reasoning_model_class` (whose rank is the §A4 downgrade threshold), `lane_cost_rank` (subscription < local < credits < metered), `sensitive_allowed_lanes` (default `[]` = deny).
- `resolve(task, snapshot)` enumerates every `(manifest, account)` pair; each lands in exactly one place (candidate or `rejected[]` with a specific reason). Rejection precedence per pair: `capability_not_offered` (absent, or `min_capability_version` too old) → `adapter_disabled` (capability `status: "disabled"`) → `account_disabled` → `plan_lacks_capability` → `ui_drift` → `health_not_ready` → `sensitivity_blocked` → `metered_not_allowed` → `pool_exhausted` → `pool_cooling_down` → (downgrade-as-exhausted) `pool_exhausted` → `pool_degraded`.
- §A4 eligibility: missing pool row reads as `unknown` and IS eligible (ranked below `available`/`estimated`, above worse-cost lanes); `local_budget` breach demotes (3rd sort key), never excludes; `degraded` serves `interactive`+`normal`, rejects `background` with `pool_degraded`; `model_downgraded` pool (live `reset_at` window) counts as `pool_exhausted` for tasks at/above the reasoning rank; `cooling_down`/`exhausted` reject, with expiry computed lazily by `effectiveState`.
- Metered lane: rejected when `!(policy.allow_metered && task.routing.allow_metered)`; otherwise kept, `requires_approval: true` when `est_metered_usd ≥ threshold`.
- Ranking: lane cost → pool-state rank (available > estimated > unknown > degraded) → budget-breach demotion → stable `adapter_id`+`account_id` tiebreak. `primary` = head, rest `fallbacks` (pre-filtered by the same rules, §A2 per-hop policy). `explain` = pick sentence + most-frequent rejection reason (with count).
- `onAttemptFailed`: stop classes `policy_denied` / `approval_required` / `content_refused` / `submission_ambiguous`, plus any error that is neither retryable nor fallback-eligible → `"stop"`. Otherwise a fresh `resolve` with the failed pair force-rejected (failure class → informational reason: `quota_exhausted`→`pool_exhausted`, `rate_limited`→`pool_cooling_down`, else `health_not_ready`).
- Also exports `laneForManifest`, `poolKeyFor` (matches the worker's `provider:account:pool` key), `requestedModelClass`, and `entitlementForAccount` (for `/v1/capabilities`).

### `src/pools.ts` — quota-pool state machine (pure) + store compositions

- `applySignal(pool, signal, now, rung) → { pool, rung }`, §A4 literal: soft kinds (`limit_banner`/`slow_mode`/`counter_visible`) → `degraded`; `hard_error` → `exhausted` until a parsed `reset_at` (ISO or relative "in N minutes/hours" from `raw_excerpt`, best-effort) else `cooling_down` on the ladder; `model_downgraded` → `degraded` + `reset_at` = signal + 3 h default; `reset_notice` → `unknown` (never `available`).
- Ladder `cooldownMsForRung`: 30 m → 1 h → 2 h → 4 h → doubling, capped 24 h. Rung is gateway-local (contract has no field) — persisted in the new `quota_pool_meta` table, passed in/out of the pure functions.
- `effectiveState(pool, now)`: lazy expiry — expired cooldown/reset/downgrade windows read `unknown`, never `available`. No probing anywhere.
- Store compositions: `applySignalToPool` (load rung → apply → persist pool + rung; creates the row on first signal, mirroring P3 behavior), `recordLocalUse` (rolling window anchored in `quota_pool_meta`; window seconds from the pool record; lapsed/unanchored window restarts the count), `recordPoolSuccess` (rung → 0; `unknown`/`cooling_down`/`exhausted` recover to `available` with windows cleared — a completed real task is §A4's one trustworthy signal; a soft-signal `degraded` state is deliberately preserved, see below).

### `src/breakers.ts` — §A4 ui_drift circuit breaker (per adapter version)

- Pure `nextBreakerState` + SQLite-backed helpers (`adapter_breakers` table, migration 0002). `> 3` consecutive `provider_ui_changed` failures (§A9 folds `selector_not_found` into that class) across any capability → `open`. `success` resets the consecutive count (breaker stays in its current state); only `probe_passed` closes an open breaker.

### Wiring

- `src/router/snapshot.ts` — `buildSnapshot(db, registry)`: accounts + manifests + pools + health, with open breakers surfaced as `ui_drift` on every account of that adapter's provider.
- `src/router/dispatch.ts` — `needsResolution` (auto mode, no provider/account pin), `resolveForNewTask` (resolve → pin `routing.provider/account_id` to the primary → stamp `route_decision`), `requeueAfterFailure` (per-hop re-check: fresh primary → task back to `queued` in the new lane; no route → stays failed with `rejected[]` persisted; `"stop"` → untouched).
- `src/http/routes_tasks.ts` — POST /v1/tasks resolves unrouted auto tasks **before** insert+enqueue; the resolved `(provider, account_id)` keys the scheduler lane via the existing `queueKeyOf` (no scheduler change). No primary → stays queued in the unrouted lane with the decision persisted.
- `src/worker/worker.ts` — `quota.signal` events and the silent-downgrade path now go through `applySignalToPool` (P3's inline kind→state mapping removed; `recordQuotaSignal` deleted from `queries.ts`). Terminal failure classes feed the fabric: `quota_exhausted`/`rate_limited` → `hard_error` signal, `model_downgraded` → downgrade signal, `provider_ui_changed` → breaker count. `done` → `recordPoolSuccess` + `recordLocalUse` + `recordAdapterSuccess`. New optional `dispatch` dep: a terminally failed attempt goes through `requeueAfterFailure`.
- `src/http/routes_capabilities.ts` — additive: each entry gains `lane` and `entitlements: [{ account_id, pool_key, pool_state, available, reason_unavailable? }]` (P3 fields untouched; no accounts → `entitlements: []`).
- `src/main.ts` — `FabricRouter` replaces `StaticRouter` (stub deleted).
- `src/store/migrations/0002_router_state.sql` — `quota_pool_meta` + `adapter_breakers`. `queries.ts` gained `listQuotaPools` + `updateTaskRoutingDecision`.

## Tests / build

- Baseline at session start (clean tree @ 16b0d96e2): **128 passed / 18 files** (first run showed 2 flaky 5 s timeouts under install load; immediate re-run 128/128 green).
- After: **195 passed / 22 files** (+67 tests in `test/router/` — router, breakers, dispatch — and `test/pools/`). All 9 verify-list scenarios are named table cases; scenario 3 (ladder) lives in `test/pools/`, scenario 4 (breaker) in `test/router/breakers.test.ts` end-to-end (failures → `ui_drift` rejection → probe pass → eligible).
- `pnpm -F subscription-gateway build` green; `tsc -b` clean.
- Hard gates: provider-name grep over `src/router`, `src/queue`, `test/router`, `test/pools` → **no matches**; same grep over `src/` minus `src/adapters/` → **no matches**, identical to HEAD (P3) state.
- `git status`: changes only under `services/subscription-gateway/` and `docs/specs/subscription-fabric/p4/`.
- Existing tests touched deliberately: `test/store.test.ts` (schema enumeration now expects migration v2 + the two new tables), `test/helpers.ts` (`makeDeps` gained an optional `router` pass-through, additive).

## Contract workarounds (gateway-local; contracts package untouched)

1. **Manifest has no `lane` field.** `laneForManifest` derives: `ui_bridge_*` → `subscription`, `official` → `metered`. A non-schema `lane` hint on the manifest object wins when present (zod strips it at YAML load, so only programmatic manifests carry it today) — that is the seam where `local`/`credits` adapters plug in when the contract grows the field.
2. **Task has no `requested_model_class`.** Read from `options.model_class` (same convention the worker already used in P3).
3. **Session health has no probe-passed marker.** Recovery mapping: an open breaker surfaces as `session_health[account_id] = "ui_drift"` in the snapshot; it closes only via `recordAdapterProbePassed`, and the account health read by the router is `ready` again. Granularity caveat: the breaker is per adapter-version but health is per account — with two adapters sharing one provider, one open breaker marks that provider's accounts `ui_drift` for all adapters. Fine at 1-adapter-per-provider; Phase 2 should revisit if that changes.
4. **Pool cooldown rung / rolling-window anchor** have no contract fields → `quota_pool_meta` table (migration 0002), passed into the pure functions as parameters.
5. `approval_required` and `policy_denied` reject reasons exist in the schema but are unused by the v1 router: metered-over-threshold is *kept* with `requires_approval: true` per the brief, and no policy rule currently produces `policy_denied` (a future `est > constraints.max_metered_usd` rule is the natural user — see open questions).

## Decisions Phase 2 must know

- **`normal` behaves like `interactive` for degraded pools** (per the brief; only `background` gets `pool_degraded`).
- **Success semantics:** `recordPoolSuccess` recovers `unknown`/`cooling_down`/`exhausted` → `available`, but preserves `degraded` — a limit banner observed mid-task stays true even when the task completes; degraded recovery stays lazy (`reset_at` expiry / `reset_notice`). This was forced by the P3 worker tests and is the §A4-consistent reading.
- **Metered estimate:** `options.est_metered_usd` else policy `metered_default_est_usd` (1.0, deliberately ≥ the 0.5 default threshold so unpriced metered always asks first). Metered requires BOTH `policy.allow_metered` and `task.routing.allow_metered`.
- **Dispatch is pick-time + hop-time, not a loop.** There is still no production dispatcher draining scheduler lanes into workers (Phase 2). `resolveForNewTask` runs at POST /v1/tasks; `requeueAfterFailure` runs at the worker boundary when `WorkerDeps.dispatch` is wired (unit-tested; nothing in `main.ts` wires it yet because no worker loop exists). `prefer`/`force` routing modes bypass the router by design (`needsResolution`).
- A task requeued after failure flips `failed` → `queued`; its `error` field is left in place as last-attempt history.
- Adapters feed `est_metered_usd`/model class via task `options`; the model catalog (Phase 2) should formalize both.

## Open questions / risks

1. Should `est_metered_usd > constraints.max_metered_usd` reject `policy_denied` (schema reason exists)? Deferred — needs product word on cap-vs-approve semantics.
2. Breaker → provider-level health mapping loses adapter granularity (caveat 3 above). Real fix is a per-adapter health/drift record in the snapshot — contract change, Phase 2.
3. `parseResetAt` is intentionally best-effort (ISO + "in N units"). Provider copy varies wildly; misses fall back to the cooldown ladder, which is the safe direction.
4. `prefer`/`force` modes skip policy re-check at enqueue — acceptable for v1 (they're explicit user pins) but Phase 2's dispatcher should still re-resolve at worker-pick time for those.
5. `recordLocalUse` only counts completed tasks (`done`), not submissions; a crashed-but-submitted task doesn't count against the soft budget. Conservative direction chosen; revisit if budget accuracy matters.
