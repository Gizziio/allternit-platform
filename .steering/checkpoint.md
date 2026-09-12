# Steering checkpoint — session/adispatch-0912

## Goal
A:// Coordination Contract v0.1 proof slice (Appendix B steps 0–9). Exit criterion: §8.24 adversarial two-worker test passes behaviorally. Canonical store = allternit-cowork-runtime SQLite. Stop before merge (PR opened, human merges).

## Just did
- All steps 0–9 built and verified (see plan file .steering/plans/plan-adispatch-0912.md).
- LIVE KILL-WORKER DEMO PASSED on a real server (port 18477, fresh DB, lease 4s, sweep 2s):
  worker A claimed gen 1 (lease_89b1…), ran step 0 + checkpoint + heartbeat, SIGKILLed;
  sweeper logged "Lease expired; recovery policy applied lease_generation=1 outcome=queued";
  worker B claimed gen 2 (lease_0e41…), replayed from checkpoint step 1, completed;
  ghost A completion (gen 1) → HTTP 409 A_STALE_LEASE_GENERATION;
  B duplicate completion → already_committed, same result_id (exactly-once);
  ledger rows all carry initiator=user/joe, delegator=principal/al, executor=A→B;
  run completed; steps 0-2 outputs present on disk.
- fix: create_job route now enqueues persisted row (state 'queued') + approvals user-filter fix + clippy fixups.

## Next
- Push, open PR (do NOT merge), report. Cleanup of demo scratch after PR.

## Open questions
- Approval↔lease binding (§8.14) and job rehydration at boot (§8.20, runs-only today) deferred — noted in PR.
