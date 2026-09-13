# Checkpoint — session/cu20-teachbatch

**Goal:** Land spec `stagehand-batch-fork` deferrals: A) record→teach→batch (commit c7c2e50c3), B) auto page binding (commit 45f5e280b), C) aci flake fix (uncommitted). Then live smoke, PR/merge/attest/cleanup.

**Just did (this resume):**
- C fix applied: `test_helpers::computer_use_dir_test_lock()` (alias of POLICY_TEST_LOCK, documented non-reentrant) added in lib.rs; the two unguarded `ALLTERNIT_COMPUTER_USE_DIR` mutators in aci_routes.rs (snapshot_throttle test, credential_binding e2e) now hold it. The other 11 mutation sites already serialize on the same mutex. Root cause of the named flake `aci_routes::policy_seat_tests::audit_api_returns_rows_with_bot_filter`.
- aci_batch 19/19 with the fix compiled. Full aci_ suite x4 running (background bash-z7wxkfhl); API binary build queued behind it (bash-iykhk16h).
- Smoke infra restarted: page :18080, headless Chrome CDP :9222.

**Next:** full aci_ x4 clean → commit C → live smoke leg 1 (compiled batch, one grant, approve, receipt 3/3) + leg 2 (ALLTERNIT_WORKFLOW_BATCH=0 per-step) via tmp-cu20-smoke/smoke.py against API :18113 → merge origin/main → push/PR/merge → attestation+LEDGER → cleanup.

**Open questions:** None.
