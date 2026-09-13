# Attestation — session/policylock-deadlock (PR #478, merge 78b300421)

**Date:** 2026-09-13 12:03 · **Agent:** kimi-code (subagent, resumed "re-run full suite when quiet" from the console-backend handoff)

## What was done

Fixed a deterministic same-thread self-deadlock that made the full `cargo test -p allternit-api` suite hang forever.

- `aci_routes::credential_binding_http_tests::run_binds_credentials_into_sandbox_env_and_leaks_nowhere` acquired `policy_config::POLICY_TEST_LOCK` (`_policy_guard`) and then `test_helpers::computer_use_dir_test_lock()` (`_dir_guard`). Both are the **same** non-reentrant `static Mutex<()>` (`lib.rs:300` — the unification was deliberate in PR #440, with a doc warning that both must never be taken together).
- Acquiring a held non-reentrant `std::Mutex` on the same thread blocks forever → the whole suite wedged: every policy-seat / computer-use / aci test thread parked in `__psynch_mutexwait` behind the self-deadlocked holder.
- Introduced by PR #440 (`f57a81859`, the `ALLTERNIT_COMPUTER_USE_DIR` serialization fix, 2026-09-12). Hidden because the Phase-7 console work honestly deferred the full green run ("machine load contention") — no full suite ran between that merge and today.

Fix: one guard (`computer_use_dir_test_lock()`, covering both serialization purposes), comment updated to state the invariant. 8 insertions / 9 deletions in `cmd/allternit-api/src/aci_routes.rs`.

## How it was found

- Resumed the handoff's deferred item: re-run `cargo test -p allternit-api` on `origin/main` in `allternit-main-check`.
- Run stalled with 0% CPU after ~50 min; `sample` of the test binary showed all 10 test threads in `__psynch_mutexwait` on the same lock.
- Code read + `lsof`/stack analysis pinned the double acquisition; `git log -S` traced both lines to `f57a81859`.

## Verification evidence

- **Repro (pre-fix):** prebuilt test binary, exact filter, solo — hangs forever:
  `allternit_api-* aci_routes::credential_binding_http_tests::run_binds_credentials_into_sandbox_env_and_leaks_nowhere --exact` → no completion in 45s (killed).
- **Post-fix:** same test passes in **1.42s** (`cargo test -p allternit-api --lib … --exact`).
- **Full suite** (`cargo test -p allternit-api`, run in `allternit-main-check` at file content identical to the PR tree): **1079 passed / 5 failed / 4 ignored / 543s**. The 5 failures are the known, previously-documented environment-only set:
  - 4× `agent_cloud_routes::tests::*_through_real_os_control_plane` — "allternitos_control_plane did not log its listening port" (needs the control-plane binary)
  - 1× `rails::tests::gate_data_plane_round_trip`
  Zero new failures. This also completes the deferred "re-run full suite when quiet" item from `~/allternit-console-backend-handoff.md`.
- Swept every `POLICY_TEST_LOCK` / `computer_use_dir_test_lock` acquisition site (aci_routes, computer_control, policy_audit, lib, policy_config) — the fixed test was the only double-acquire; all others take the single lock once per test.

## Incidents / honest notes

- Verification ran in the `allternit-main-check` worktree (at `b3de74950`) rather than the session worktree because its warm `target/` allowed an incremental build on a machine under heavy load (load avg 60–90). The four files touched by this fix are byte-identical between `b3de74950` and the merge base `f24afb40a` (`git diff --stat` empty), so the result transfers exactly.
- The 5 environment failures predate this change and are not addressed here.

## Cleanup

- `git worktree remove` on `allternit-session-policylock` + `allternit-attest-tmp`; session branch `session/policylock-deadlock` deleted local + remote; attest branch `attest/policylock` deleted local + remote.
