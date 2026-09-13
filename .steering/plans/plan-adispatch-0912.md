# Plan — A:// dispatcher proof slice (session/adispatch-0912)

Spec: `docs/A_COORDINATION_CONTRACT_V0_1.md` §8, Appendix B. Exit criterion: §8.24
adversarial two-worker test passes behaviorally. Canonical store = Rust runtime
SQLite (as wired inside cmd/allternit-api). Stop before merge.

## Architecture decisions (from anchor verification)

- Persistence layer actually found: `cowork_*` SQLite tables owned by
  `cmd/allternit-api` (DbHandle, `src/db.rs`). The runtime RunManager keeps
  in-memory mirrors; the API routes persist. The job-row CAS therefore lives in
  the runtime crate as store-level functions over `rusqlite::Connection`
  (`src/sqlite_store.rs`), called with `state.db.connect()` by the API and with a
  temp DB by the integration test. Same DB file = canonical store (lock 1, 2).
- Dispatcher/lease protocol types + errors (`A_*` codes, §8.23) in runtime crate
  `src/dispatch.rs`.
- Sweeper replaces the empty lease-renewal loop in `run.rs`: RunManagerConfig
  gains `store_path` + `lease_sweep_interval_secs`; loop calls
  `sqlite_store::expire_leases`.
- v0.1 discovery = long-poll claim endpoint (lock 4): `POST /dispatch/claim`
  with `wait_secs`, retrying inside the handler.
- Attribution triple: `initiator`/`delegator` on `cowork_runs`/`cowork_jobs`,
  `initiator`/`delegator`/`executor` columns on `cowork_run_events`; every
  dispatch event writes all three (§8.18).
- Server clock authoritative: lease_expires_at stored RFC3339 UTC from server;
  `worker_time` in heartbeat accepted but only logged (lock 3).

## Todos

- [x] Step 0: commit contract (`docs/A_COORDINATION_CONTRACT_V0_1.md`)
- [ ] Steps 1–2: migrations V152 principals, V153 job lease columns, V154 event attribution
- [ ] Steps 1–3: runtime dispatch types + sqlite_store (auth, CAS claim, heartbeat, renew, complete, sweep) + RunManager sweeper wiring
- [ ] Step 3: API routes `rails/routes_a_dispatch.rs` (principal create, claim long-poll, heartbeat, renew, complete, result read), bearer-token auth
- [ ] Step 9 (test-first): `tests/dispatch_conformance_tests.rs` adversarial two-worker test
- [ ] Steps 4–8 verified through the test (CAS, expiry/requeue, heartbeat/renew, attribution, completion validation/idempotency)
- [ ] Optional small commit: `GET /cowork/approvals` user filter fix
- [ ] Verify: cargo test -p allternit-cowork-runtime, cargo build -p allternit-api, clippy, fresh-DB migrations
- [ ] Live kill-worker demo (real server, worker A SIGKILL, observed event sequence)
- [ ] Push session branch, open PR (do NOT merge), checkpoint + report

## Out of scope (deferrals to note)

- Approval↔lease binding / approval invalidation on expiry (no approval binding
  in schema; Appendix B does not schedule it)
- Connector broker, compute placement beyond local, CommRails push, model
  execution, Cowork UI, cowork_executions dead-end cleanup, cloud-api, desktop path
