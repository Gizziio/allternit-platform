# Cowork Runtime State-Machine Reference

**Status:** Reference. Grounded in `types.rs`, `run.rs`, `transport.rs`,
`sqlite_store.rs` (`infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/`),
`fabric_transport_routes.rs`, and `cmd/allternit-api/src/main.rs`.

Companion: `A_PROTOCOL_SCHEMA.md` (wire shapes), `FABRIC_TRANSPORT.md` (lease semantics).

**Source-of-truth rule:** the canonical state lives in the SQLite store
(`cowork_runs`, `cowork_jobs`). The `RunManager` in-memory maps are a
best-effort mirror (`load_run`/`load_job`, post-transition sync, sweeper sync).
UI must project from the persisted store, not from narration.

---

## 1. RunState

Defined in `types.rs::RunState`; validated transitions in
`run.rs::is_valid_run_transition` (in-memory path) and enforced at the store
by the claim CAS and completion CAS.

```text
created → planned → queued → running → paused
                                │         │
                                │         └→ cancelled
                                ├→ awaiting_approval → running
                                ├→ recovering → running | failed
                                └→ completed | failed | cancelled
```

| Transition | Caused by | Persistence effect |
|---|---|---|
| `created → planned` | `POST /runs/:id/start` step 1 (`transition_run_state`) | `UPDATE cowork_runs.state` (route mirrors) |
| `planned → queued` | `POST /runs/:id/start` step 2 | state=`queued`; event `run_queued` |
| `queued → running` | **claim CAS** (`sqlite_store::claim_job`): first lease grant sets `state='running'` atomically in the same transaction as the lease | `UPDATE cowork_runs ... WHERE state='queued'` |
| `queued → cancelled` | `POST /runs/:id/cancel` | state, `completed_at` |
| `queued → recovering` | `POST /runs/:id/recover` (checkpoint present) | state=`recovering`; event `run_recovered` |
| `running → paused / awaiting_approval / completed / failed / cancelled` | run-state endpoint or completion CAS (last job terminal sets `completed`/`failed`) | terminal writes `completed_at` |
| `paused → running / cancelled`; `awaiting_approval → running / cancelled`; `recovering → running / failed` | run-state endpoint / recovery outcome | — |
| terminal → anything | **invalid** (`InvalidStateTransition`) | none |

Run-state honesty (§8.2): `start_run` stops at `queued`; a run is `running`
only while a worker holds a valid lease. Do not report `running` from model
text or from run creation alone.

## 2. JobState

Defined in `types.rs::JobState` (`FromStr` added for rehydration). Job
transitions are **store-first**: the transport functions CAS the persisted row;
`run.rs::transition_job_state` (unvalidated, mirror-only) is called
best-effort from the API sync path.

```text
scheduled → queued → leased → running → checkpointing → running
   (create)   (route)  (claim CAS)  (worker)     (worker)
                        │  ▲                    │
                        │  └─ renew extends expires_at, state unchanged
                        ▼
              ┌── lease expiry (sweeper/boot CAS)
              ▼
        queued (retry_count+1 ≤ max_retries)   [generation preserved; next claim bumps it]
        dead_letter (retry_count+1 > max_retries)
        
leased/running → completed | failed   (completion CAS; releases lease in-row)
any non-terminal → cancelled          (run cancellation)
```

| Transition | Caused by | Persistence effect |
|---|---|---|
| `scheduled → queued` | `POST /runs/:id/jobs` (route updates the persisted row; in-memory keeps `scheduled` until mirror sync) | state=`queued`, `required_capabilities`, `initiator`, `delegator` from run |
| `queued → leased` (+gen+1) | `claim_job` CAS: `UPDATE ... WHERE id=? AND state='queued' RETURNING lease_generation` | `lease_owner`, `lease_id`, `lease_generation+1`, `lease_expires_at`, `claimed_at`, `started_at`; event `job.claimed` (triple) |
| `leased → running` | worker-side execution marker (mirror; store stays `leased` unless route-written) | — |
| heartbeat / renew | `record_heartbeat` (event only), `renew_lease` CAS extends `lease_expires_at` | event `job.heartbeat` / `job.lease_renewed` |
| `leased/running → queued` or `dead_letter` | `expire_leases` CAS: same `lease_id` + `lease_expires_at` must still match (a renew mid-sweep keeps the lease) | lease cleared; `retry_count+1`; events `job.lease_expired` (executor) + `job.requeued` / `job.dead_lettered` (no executor); bound approvals → `invalidated` + events |
| `leased/running → completed/failed` | `complete_job` CAS: state+`lease_id`+`lease_generation`+`lease_owner` must match; lease released in-row | `result`, `completed_at`; events `job.completed`/`job.failed` + `result.created`; run advanced when no non-terminal jobs remain (`run.completed`) |
| repeat complete (same terminal gen) | idempotent path | returns canonical result; **no** new writes |
| stale-generation complete | rejected before terminal check | `A_STALE_LEASE_GENERATION` even on terminal jobs |

Boot (`main.rs`): `expire_downtime_leases` (server clock; requeue/dead-letter
leases that died while down, approvals expired too) → `load_persisted_cowork_runs`
→ `load_persisted_cowork_jobs` (all jobs incl. leased, with
`lease_id`/`lease_generation`/`required_capabilities` round-tripped).

## 3. ApprovalBinding status machine

`pending → granted | denied` (human, before `expires_at`; late → `A_APPROVAL_INVALID`)
`pending → expired` (approval sweeper/boot past `expires_at`; event `approval.expired`)
`pending|granted → invalidated` (bound lease generation expired; event `approval.invalidated`)

`check_approval` outcomes: granted (current generation) → OK; pending →
`A_APPROVAL_REQUIRED`; expired/denied → `A_APPROVAL_REQUIRED` (re-request
policy); stale generation/invalidated → `A_APPROVAL_INVALID`; risk-rule
auto-approve short-circuits before binding lookup.

## 4. How Cowork/UI should project

1. Run/job cards read `cowork_runs`/`cowork_jobs` (canonical) — never transcripts.
2. "Running" badge ⟸ run `running` AND job `leased`/`running` with
   `lease_expires_at` in the future; show lease generation on technical views.
3. Recovery surfaced from `job.requeued`/`job.dead_lettered`/`approval.invalidated`
   events, ordered by `rowid` (same-second `created_at` is coarse).
4. Attribution display: `initiator`/`delegator`/`executor` columns on material
   events; executor `NULL` on `job.requeued` is deliberate (transport action).
5. Approval UI polls `GET /fabric/transport/approvals/:id`; decisions are
   user-auth endpoints; show `expires_at` and countdown.
