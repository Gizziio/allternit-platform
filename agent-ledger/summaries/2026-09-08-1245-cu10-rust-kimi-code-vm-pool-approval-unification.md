# Session cu10-rust — VM pooling + approval unification + run-buffer durability
- Branch session/cu10-rust → PR #164 → merge 04e36c936
- vm_pool.rs: warm pool in front of /sandbox/execute (min_idle/max_total/idle_ttl env, kill switch), health probe before checkout, fail-closed 503, GET /sandbox/pool, durable pool-state.json with boot reclamation of orphaned VMs. HTTP smoke: warm reuse + simulated restart + restored VM reuse.
- Approval unification: GET /api/aci/approvals/{id} unified status across hash-grants/handoffs/proxied ACU futures; TTL aligned to 120s (Python binding constraint, documented); receipts → append-only JSONL with boot reload.
- Run-buffer durability: ACI_RUN_EVENTS snapshot/restore (2s throttle, tmp+rename), corrupt snapshots skipped.
- Verified: cargo test 723 passed / 4 pre-existing agent_cloud_routes env fails (+16 new; baseline 707/4). Full-binary live boot infeasible (no mock driver selectable via env). Pre-existing flake noted: idempotency in_progress_request_returns_conflict under extreme load.
