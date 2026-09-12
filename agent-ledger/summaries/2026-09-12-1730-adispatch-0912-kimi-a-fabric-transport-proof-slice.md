# Attestation — session/adispatch-0912 — A:// Coordination Contract v0.1, fabric-transport proof slice

**Date:** 2026-09-12 (afternoon)
**Agent:** kimi (subagent of the ao orchestrator)
**PR:** #422 — merged as `28457d6a6904ac5771d6b7a64ffcacbe0633a915` (merge commit)
**Worktree:** `allternit-session-adispatch-0912` on `session/adispatch-0912` (left in place; continuation in progress)

## What was done

First working execution slice of the A:// Coordination Contract v0.1
(`docs/A_COORDINATION_CONTRACT_V0_1.md`, §8 + Appendix B): a durable
fabric-transport/lease protocol proving a job claimed by a worker survives that
worker's death. Owner directive folded in before merge: the component formerly
called "dispatcher" is renamed **fabric transport** throughout code, routes,
env vars, error codes, file names, and the contract doc (behavior unchanged).

### Built (per Appendix B step)

- **Step 0** — contract committed: `docs/A_COORDINATION_CONTRACT_V0_1.md`.
- **Steps 1–2** — migrations **V152** (`cowork_principals`: id, workspace,
  capabilities JSON, token hash, status), **V153** (job lease columns
  `lease_id`, `lease_generation`, `lease_expires_at`, `claimed_at` +
  `required_capabilities`, `result`, `initiator`, `delegator`),
  **V154** (event attribution triple + `cowork_runs.delegator`). Numbered V152+
  because main took V149 while this branch was open.
- **Steps 1–3** — runtime crate `src/transport.rs` (PrincipalRecord, LeaseGrant,
  CompleteOutcome, ExpiryAction, `A_*` error codes, token hashing) and
  `src/sqlite_store.rs`: bearer-token auth (SHA-256 hashed), eligibility +
  transactional CAS claim, heartbeat, renew, completion validation, sweeper.
  HTTP surface `cmd/allternit-api/src/rails/fabric_transport_routes.rs` under
  `/api/v1/fabric/transport/*` (aligned with existing `/api/v1/fabric/*`
  conventions): principals create, claim (long-poll `wait_secs`), jobs/:id
  heartbeat/renew/complete, jobs/:id read. Env: `ALLTERNIT_FABRIC_TRANSPORT_LEASE_SECS`,
  `ALLTERNIT_FABRIC_TRANSPORT_SWEEP_SECS`.
- **Step 4** — claim = `UPDATE cowork_jobs ... WHERE id=? AND state='queued'
  RETURNING lease_generation` inside an immediate transaction; eligibility
  (workspace, capabilities, run state) evaluated in fabric transport; CAS
  decides the single winner. 8-thread concurrent-claim test: exactly one winner.
- **Step 5** — the previously EMPTY lease-renewal loop in `run.rs:560-592`
  replaced with the real sweeper (config `store_path` + sweep interval): expires
  leases by server clock, attributed `job.lease_expired` event, requeue or
  dead-letter per policy (retry_count+1 > max_retries → `dead_letter`).
- **Step 6** — heartbeat/renew endpoints; `worker_time` advisory only; renewal
  never resurrects an expired generation.
- **Step 7** — attribution triple (initiator/delegator/executor) on every
  material dispatch event, verified in tests and live.
- **Step 8** — completion validates executor + lease_id + generation +
  server-clock expiry; stale generation rejected even for terminal jobs
  (killed worker can never complete under an old generation); terminal repeat
  returns the canonical existing result (exactly-once); run advanced when no
  non-terminal jobs remain.
- **Step 9** — `tests/transport_conformance_tests.rs`: the §8.24 adversarial
  two-worker test (A claims gen 1 → checkpoints → dies → sweeper requeues → B
  claims gen 2 → replays from A's checkpoint → ghost A completion rejected
  A_STALE_LEASE_GENERATION → exactly-once result → ledger triple), plus
  dead-letter exhaustion and concurrent-claim tests.

### Also in the PR

- `POST /runs/:id/jobs` now enqueues the persisted row (`state='queued'`,
  `required_capabilities`, run attribution) — previously jobs stayed
  `scheduled` forever and nothing was claimable.
- `fix(cowork): scope GET /cowork/approvals to the authenticated user` — the
  contract-named non-conformant unscoped listing bug.

## How it works

The canonical store is the `cowork_*` SQLite tables owned by `cmd/allternit-api`
(lock 1). Fabric-transport protocol functions in the runtime crate operate on
`rusqlite::Connection` (the API passes `state.db.connect()`; tests use a temp
DB with the same DDL). All state changes are store-level CAS in immediate
transactions; the RunManager's in-memory maps are a best-effort mirror synced
after transitions. The sweeper runs as a RunManager background task against the
same DB file, so expiry survives process restarts of workers (server clock
authoritative, lock 3).

## Verification evidence

- `cargo test -p allternit-cowork-runtime` — 10/10 green.
- `cargo build -p allternit-api` — green. Clippy on touched crates: no new
  warnings from this change.
- Fresh-DB migration check: V152–V154 apply cleanly on a brand-new data dir.
- **Live kill-worker demo** (real server, lease 4s, sweep 2s): A claimed gen 1,
  ran step 0 + checkpoint + heartbeat; `kill -9`; sweeper logged
  `Lease expired; recovery policy applied lease_generation=1 outcome=queued`;
  B claimed gen 2, grant carried A's `current_checkpoint_id`, B replayed from
  step 1 and completed; ghost A completion → HTTP 409 A_STALE_LEASE_GENERATION;
  B duplicate completion → `already_committed` with the same `result_id`;
  `result.created` exactly once; run `completed`; ledger rows all carry
  initiator=`a://workspace/allternit/user/joe`,
  delegator=`a://workspace/allternit/principal/al`, executor=A→B.

## Incidents / deviations

- Main took migration number V149 while this branch was open; this branch's
  migrations were renumbered V152–V154 during conflict resolution (no schema
  change, numbers only).
- The shared checkout was on another session's branch (`ao/platform-console-agents`)
  with uncommitted work at merge time, so the ledger commit was landed via a
  temporary worktree (`allternit-ledger-adispatch`) instead of the shared
  checkout. The shared checkout was not touched.
- The first `gh pr create` heredoc had its inline-code backticks evaluated by
  the shell; the PR body was rewritten from a file before merge.

## Honest deferrals (landed in the continuation PR, not this one)

- Approval ↔ lease binding (§8.14) with lease-expiry invalidation.
- Boot-time job rehydration (§8.20) incl. downtime-expired lease recovery.
- Extended §8.24 conformance test covering the approval steps.
- `start_run` still marks runs `running` immediately (pre-existing).
