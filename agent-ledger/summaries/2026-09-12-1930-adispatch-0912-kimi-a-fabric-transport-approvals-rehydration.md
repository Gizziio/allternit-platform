# Attestation — session/adispatch-0912 (phase 2) — A:// approval↔lease binding + boot rehydration + full §8.24 conformance

**Date:** 2026-09-12 (evening)
**Agent:** kimi (subagent of the ao orchestrator)
**PR:** #429 — merged as `0281ba515cc72cb03a89e950c19992a6ef04914f` (merge commit)
**Worktree:** `allternit-session-adispatch-0912` on `session/adispatch-0912`

## What was built

Continuation of the A:// fabric-transport proof slice (#422), clearing the two
deferrals from that PR:

### Approval ↔ lease binding (contract §8.14)

Approvals scoped to (executor, capability, target, run_id, job_id,
lease_generation), enforced inside fabric transport:

- Migration **V155** `cowork_approval_bindings`.
- Store protocol (`allternit-cowork-runtime/src/sqlite_store.rs`):
  `request_approval` (idempotent per scope+generation), `check_approval`
  (A_APPROVAL_REQUIRED / A_APPROVAL_INVALID / granted), `decide_approval`
  (human grant/deny). Lease expiry — sweeper and boot pass — invalidates every
  binding of the expired generation with an executor-attributed
  `approval.invalidated` event; stale-generation reuse is rejected, so
  approvals can never be replayed across reassignment.
- HTTP (`cmd/allternit-api/src/rails/fabric_transport_routes.rs`):
  `POST /api/v1/fabric/transport/jobs/:id/approvals/{request,check}` (worker
  bearer auth), `GET /api/v1/fabric/transport/approvals/:id`,
  `POST .../{grant,deny}` (user auth).

### Boot-time rehydration + downtime recovery (contract §8.20)

At boot `cmd/allternit-api` runs one `expire_leases` pass (server clock;
downtime-expired leases get requeue/dead-letter recovery, never silent loss),
then rehydrates ALL runs and ALL jobs (queued AND leased) into the RunManager
mirror (`load_persisted_cowork_jobs`, `RunManager::load_job`). The runtime
`Job` type now round-trips `lease_id`, `lease_generation`,
`required_capabilities` (plus `FromStr` for `JobState`).

### Full §8.24 conformance test

`test_full_824_sequence_with_approval` runs the entire proof sequence
including approvals: protected action → approval required → granted → worker
killed → gen-1 approval invalidated → gen-2 worker re-obtains approval →
killed worker's completion rejected A_STALE_LEASE_GENERATION → exactly-once
result → attributed ledger. Plus `test_downtime_expiry_recovers_at_boot`.

### Run-state honesty (§8.2)

`POST /runs/:id/start` stops at `queued`; the claim CAS moves the run to
`running` atomically with the first lease grant — RUNNING means a worker holds
a lease.

### Contract doc

§8.14/§8.20 marked Implemented with file pointers; Appendix A approval/event
entries refreshed; §16 scorecard updated; changelog entry.

## Verification evidence

- `cargo test -p allternit-cowork-runtime` — 12/12 green.
- `cargo build -p allternit-api` — green. Clippy on touched crates: no new
  warnings.
- Fresh-DB migration check: V155 applies cleanly.
- **Live full-sequence demo** (fresh DB): A claimed gen 1 → protected step →
  A_APPROVAL_REQUIRED → granted → executed → SIGKILLed → sweeper requeued the
  job AND invalidated the gen-1 approval → B claimed gen 2 →
  `409 A_APPROVAL_INVALID (approval bound to generation 1, current is 2)` →
  re-approved under gen 2 → completed exactly-once (duplicate returned the same
  result_id) → ghost A completion `409 A_STALE_LEASE_GENERATION` → run
  completed; ledger carries the full event story with the
  initiator/delegator/executor triple. A second unplanned failover (B's 30s
  lease lapsing between demo steps) also recovered correctly.

## Incidents / honest deferrals

- **Desktop rebuild not completed in this phase.** The single permitted
  attempt failed because the release sidecar build ran against the session
  worktree while it was mid-edit (compile errors since fixed; preflight was
  35/0). Retried cleanly in phase 3 — see its attestation.
- Approval timeout/auto-deny semantics: still open (phase 3, owner directive).
- Client-supplied `event_id` idempotency: still open (phase 3).
- `ApprovalGate` risk-rules engine unification with lease bindings: still open
  (phase 3).
- Shared checkout was on another session's branch at merge time; the ledger
  commit landed via a temporary worktree per the established approach.
