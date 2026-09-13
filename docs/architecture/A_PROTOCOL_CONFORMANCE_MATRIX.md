# A:// Conformance Test Matrix

**Status:** Reference / proof index. Every row names its concrete proof:
a test in `infrastructure/executor/cowork/cowork/allternit-cowork-runtime/tests/transport_conformance_tests.rs`,
an endpoint behavior, or live-demo evidence (run 2026-09-12 against a real
server, recorded in the PR #429/#436 bodies and the session attestations).

The rule being enforced (§16 of `A_PROTOCOL.md` / §16 of the index README):

> A component that only stores an `a://` identifier is not A:// conformant.

See the last section for the adjacent-plumbing inventory.

---

## 1. Worker conformance (§17 list)

| Claim | Proof | Status |
|---|---|---|
| Resolve/authenticate a principal identity | `authenticate_principal` exercised in every test via `auth()`; failure paths live (bad token → `A_AUTHENTICATION_FAILED`) | ✅ |
| Declare and satisfy capabilities | Eligibility rejection asserted: `test_adversarial_two_worker_failover` (no-shell principal → `A_CAPABILITY_MISSING`); concurrent winner test | ✅ |
| Claim work under canonical execution-ownership rules | Store-level CAS: `test_concurrent_claims_single_winner` (8 threads, exactly 1 winner); targeted claim conflict → `A_JOB_ALREADY_LEASED` | ✅ |
| Maintain or lose a lease correctly | Heartbeat + renew asserted (`test_adversarial_two_worker_failover`); renew of stale gen → `A_STALE_LEASE_GENERATION`; expiry by server clock in both failover tests | ✅ |
| Emit attributable events | Every event-row assertion checks the initiator/delegator/executor triple (`event_rows` helper); live ledger dumps in PR #429 | ✅ |
| Obey approval/policy boundaries | `test_full_824_sequence_with_approval` (request→grant→gate→invalidate→re-obtain); `test_approval_expiry_and_late_grant_rejected`; `test_risk_policy_single_evaluation_path` (auto-approve/auto-deny/requires) | ✅ |
| Reject stale execution authority | Ghost completion → `A_STALE_LEASE_GENERATION` **even on terminal jobs**; ghost heartbeat rejected; stale approval → `A_APPROVAL_INVALID` (live: "approval … is bound to lease generation 1, current is 2") | ✅ |
| Commit a result exactly once | Duplicate completion → `already_committed` + identical `result_id`; `test_event_post_idempotency` extends the same guarantee to client events (3 deliveries → 2 rows) | ✅ |

## 2. Control-surface conformance (§17 list)

| Claim | Proof | Status |
|---|---|---|
| Create or observe intents | Run/job creation via `POST /runs`, `POST /runs/:id/jobs` (implemented); IntentEnvelope as a type: **Planned** (`A_PROTOCOL_SCHEMA.md` §9) | ⚠️ partial |
| Observe canonical run state | `GET /runs`, `GET /runs/:id/jobs`, `GET /fabric/transport/jobs/:id` read the store; state-machine reference in `COWORK_RUNTIME_STATE_MACHINES.md` | ✅ (API) |
| Display approvals | `GET /fabric/transport/approvals/:id` (worker-scoped); human grant/deny endpoints; `GET /cowork/approvals` now user-filtered (bug fixed in #422) | ✅ (API; Cowork UI surfacing partial) |
| Display attributed events | `GET /runs/:id/events` + SSE stream return attribution columns (V154) | ✅ (API; UI partial) |
| Display completion/failure | CompleteOutcome + job view expose state/result; run advanced to terminal | ✅ (API; UI partial) |

## 3. §8.24 proof-of-protocol sequence

| Step | Proof |
|---|---|
| 1–4 intent → run → job → queue | Run/job routes; `start_run` stops at `queued` (§8.2 honesty, #429) |
| 5–7 eligibility, auth, claim gen 1 | Adversarial test + live demo (worker A, `lease_89b1…`) |
| 8–12 protected action → approval → grant → resume | `test_full_824_sequence_with_approval` + live demo (`appr_3709…` granted, payment step executed) |
| 13–17 worker killed → expiry → approvals invalidated → requeue | Sweeper CAS asserted (state, retry_count, lease cleared); `approval.invalidated` with executor attribution; live server-log line captured |
| 18–20 replacement claims gen 2, checkpoint replay, protected action re-evaluated | Grant carried `current_checkpoint_id`; replay from step 1 (live) / step boundary (test); re-check → `A_APPROVAL_INVALID` |
| 21–23 re-approval, completion, exactly-once result | Binding 2 under gen 2 granted; `result.created` exactly once; duplicate → canonical `result_id` |
| 24 canonical state observable | Job view + run `completed` in store |
| 25 ledger triple | `initiator=user/joe`, `delegator=principal/al`, `executor=A→B` on every material event (test assertions + live dump) |
| Killed worker cannot complete later | Ghost completion `A_STALE_LEASE_GENERATION` (asserted post-completion, live 409) |

## 4. The four locks (§8.0)

| Lock | Proof |
|---|---|
| 1. Canonical store = Rust runtime SQLite as wired in cmd/allternit-api | All protocol fns take `rusqlite::Connection` over the API's DB (`DbHandle::connect` in handlers; same file the sweeper/rehydration uses); conformance tests run the identical store code on temp DBs |
| 2. Claims atomic at the persistence layer | `UPDATE cowork_jobs … WHERE id=? AND state='queued' RETURNING lease_generation` in an immediate transaction; concurrency test; no in-process lock anywhere in the claim path |
| 3. Recovery = replay from last committed checkpoint; server clock authoritative | `current_checkpoint_id` in LeaseGrant; sweeper/boot expiry judged on stored `lease_expires_at` vs `Utc::now()` — `worker_time` is accepted but never read for expiry; downtime test |
| 4. v0.1 discovery = long-poll claim | `wait_secs` loop in the claim handler; documented as the only correctness-relevant discovery; no push machinery in the protocol path |

## 5. Adjacent plumbing, NOT conformance

These store `a://`-shaped data or touch the vocabulary without participating
in the lifecycle. Per §16 they must not be cited as A:// conformance:

| Component | Why it is not conformance | Reference |
|---|---|---|
| `cowork_executions` dead-end inserts (`cowork_routes.rs` run-agent/team-execute) | Rows are inserted and never read back; no run/job lifecycle, no lease | Contract Appendix A |
| gizzi-code fake remote modes | Simulated remote execution without principal auth, leases, or attributed events | Out of scope per slice |
| cloud-api cowork models (`cmd/allternit-cloud-api`) | A second, separate run/job store (Postgres/sqlx) that does not participate in the canonical SQLite spine | Lock 1; Appendix A |
| `agents` / `cowork_personas` tables | Store model/provider/prompt and persona data — product records, not execution principals; unlinked to `cowork_principals` | `BOT_AUTHORING_SPEC.md` §0 |
| Webhook subscription/trigger routes | Emit/ingest events into their own pipeline; they do not create canonical Intent/Run work | `BOT_AUTHORING_SPEC.md` §9 |
| Artifact `a://` address display in Cowork/chat | An address string rendered in UI; no lifecycle participation | artphase2 ledger entry |
| `cowork_memory_entries`, schedules DB | Scoped data/trigger substrate; durable but not execution-ownership state | — |
| CommRails ledger mirroring of runtime events | Transport substrate carrying already-attributed events; carries semantics, does not define them | `A_PROTOCOL.md` §15 |

## 6. Honest gaps in the conformance story

- **Intent envelope** — the conformance path starts at run creation; intent
  idempotency (`intent_id` → canonical run) is Planned, untested.
- **Delegation chains** — depth/cycle enforcement (§8.15) is Planned; the
  triple is attributed but chains are not stored or validated.
- **Non-local compute** — all conformance proofs run `compute: local`;
  placement is out of scope for v0.1 (lock 1, §8.8).
- **UI conformance** — API-side control conformance is proven; Cowork UI
  rendering of leases/bindings/attribution is Partial and unproven here.
- **Gizzi as transport worker** — spec'd in `GIZZI_WORKER_SPEC.md`, not wired;
  no conformance claim until it claims leases as `principal/gizzi`.
