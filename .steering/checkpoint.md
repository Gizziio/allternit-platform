# Steering checkpoint — session/adispatch-0912

## Goal
A:// Coordination Contract v0.1 proof slice (Appendix B steps 0–9): principals/auth, store-level CAS claim, lease expiry sweeper + requeue, heartbeat/renew, attribution triple, completion validation, and the adversarial two-worker kill test. Exit criterion: step 9 passes behaviorally. Canonical store = allternit-cowork-runtime SQLite. Stop before merge (PR opened, human merges).

## Just did
- Created worktree allternit-session-adispatch-0912 on session/adispatch-0912 from origin/main.
- Copied contract to docs/A_COORDINATION_CONTRACT_V0_1.md (1289 lines), read fully (§8 locks, §8.24 test, Appendix B).
- TODO: commit contract, verify code anchors.

## Next
- Step 0 commit; verify run.rs/types.rs/store/migrations/routes anchors.

## Open questions
- None.
