# Checkpoint — session/cu10-rust

## Goal
TASK cu10-rust: push the Allternit computer-use Rust stack to A grade.
1. Environment pooling (warm VM pool, min_idle/max_total/idle_ttl, checkout/checkin, health check, fail-closed 503, durable pool state across restarts).
2. Approval unification (GET /api/aci/approvals/{id} unified status; TTL alignment Rust 300s vs Python 120s; JSONL receipts under ~/.allternit/computer-use/receipts/ + reload on boot).
3. Run-buffer durability (ACI_RUN_EVENTS snapshot/restore).
Surgical scope: cmd/allternit-api/** and cmd/allternit-computer-cloud/** only. Do NOT merge — orchestrator merges.

## Just did
- Stage 1 (pool) implemented: new cmd/allternit-api/src/vm_pool.rs (VmPool, PoolConfig from env, checkout/checkin, health probe, fail-closed PoolError, reap_expired top-up, pool-state.json restore with checked-out VMs marked for reclamation, global init + maintenance task), wired into sandbox_routes (/sandbox/execute pooled path + GET /sandbox/pool stats) and main.rs init_global. cargo check clean.
- Stage 2 (approvals) implemented: unified UnifiedApprovalStatus (pending/approved/denied/expired/consumed), GET /api/aci/approvals/:id resolving hash_grant → handoff → acu_run (proxies ACU GET /runs/{id}; awaiting_approval→pending, approval_timed_out→expired, else consumed); TTL aligned to 120s (Python _DIRECT_APPROVAL_TIMEOUT_SECONDS is the binding constraint; documented in aci_approvals.rs); receipts now append-only JSONL at <computer_use_dir>/receipts/receipts.jsonl with reload-on-boot (ActionGrantStore::new_persisted).
- Stage 3 (run buffer) implemented: RunEventBuffer gains throttled snapshot (2s interval, forced on done) to <computer_use_dir>/run-buffers/<run_id>.json (tmp+rename), restore at Lazy boot; corrupt snapshots skipped.
- Tests added: 8 vm_pool tests (mock driver), unified_status mapping, receipts JSONL roundtrip, snapshot/restore roundtrip + corrupt-skip + throttle behavior, acu-run mapping.
- computer_use_dir() helper in aci_approvals.rs (env ALLTERNIT_COMPUTER_USE_DIR override).

## Next
- Get green: cargo test -p allternit-api --lib vm_pool / aci_ (running in background, compiles are slow), then full cargo test -p allternit-api.
- Live smoke: boot api briefly with mock/no driver, exercise /sandbox/pool + approvals status + receipts/restart restore.
- Commit per stage (feat), push -u origin session/cu10-rust, gh pr create.

## Open questions
- TTL: picked 120s (matches Python future timeout; grant outliving its future is useless). Python side unchanged (outside sole ownership).
- Pool fronts /sandbox/execute only (vm_session has per-session mounts/bootstrap; pooling doesn't fit).
- Baseline on main: 707 passed / 4 pre-existing agent_cloud_routes env fails (brief said 698 — main gained 9 tests since).
