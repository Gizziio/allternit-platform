# Checkpoint — session/cu10-rust

## Goal
TASK cu10-rust: environment pooling + approval unification + run-buffer durability for the Allternit computer-use Rust stack. Sole ownership: cmd/allternit-api/**, cmd/allternit-computer-cloud/** (latter untouched — pooling lives in the api crate). Do NOT merge — orchestrator merges.

## Just did
- Stage 1 feat(api): warm VM pool — cmd/allternit-api/src/vm_pool.rs (new), sandbox_routes.rs (/sandbox/execute pooled, GET /sandbox/pool), main.rs init_global, lib.rs. Commit 37fbbd2fa.
- Stage 2 feat(api): unified approvals + durability — aci_approvals.rs (UnifiedApprovalStatus, 120s TTL aligned to Python _DIRECT_APPROVAL_TIMEOUT_SECONDS, JSONL receipts reload-on-boot, computer_use_dir()), aci_routes.rs (GET /api/aci/approvals/:id hash_grant→handoff→acu_run, run-buffer snapshot/restore). Commit 44c91e738.
- Stage 3 test(api): live HTTP smokes (sandbox pooled execute + restart reuse via init_global_for_test; unified approval status over HTTP incl. honest-error leg). Commit ad0b7923a.
- Fixed en route: MutexGuard-held-across-persist self-deadlock in checkout; mock-driver test semantics (kill_vm targeted exec failure).

## Verification so far
- cargo check -p allternit-api: clean (also --tests).
- vm_pool tests: 8/8. aci tests: 27/27. HTTP smokes: 2/2.
- Full suite (pre-smoke-tests compile): 721 passed / 4 failed — failures are exactly the 4 pre-existing agent_cloud_routes env fails ("allternitos_control_plane did not log its listening port"), identical to main baseline (707/4; +14 new tests since).
- Final full suite incl. smoke tests running now (expect 723/4).

## Next
- Confirm final suite numbers; push -u origin session/cu10-rust; gh pr create with summary + evidence.
- Report: PR number, per-stage results, verification, deferrals.

## Open questions / deferrals
- Full-binary live boot not feasible: no mock driver selectable via env for the real binary (initialize_vm_driver wires only Incus/Tart, which would provision real VMs). Simulated-restart HTTP smoke covers the same ground at the route layer.
- Python ACU side untouched (outside sole ownership): its 120s timeout is the documented binding constraint for the aligned TTL.
- Receipts JSONL is append-only and unbounded on disk by design (audit trail); in-memory cap stays at 10k.

## Done — PR opened
- PR #164: https://github.com/Gizziio/allternit-platform/pull/164 (OPEN, base main)
- Rebased onto a35aaa458 mid-session (other sessions merged #159/#162/#163); only .steering/checkpoint.md conflicted, resolved keeping this session's file.
- Final verification: cargo check clean; cargo test -p allternit-api = 723 passed / 4 failed (4 = pre-existing agent_cloud_routes env fails, identical to main baseline 707/4). 16 new tests all green.
- Branch session/cu10-rust pushed; worktree left intact for orchestrator merge + resume safety. Not merging (orchestrator owns merge + ledger attestation).
