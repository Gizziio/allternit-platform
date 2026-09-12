# Steering checkpoint

## session/adispatch-0912 (this worktree — A:// fabric-transport proof slice)

### Goal
A:// Coordination Contract v0.1 proof slice (Appendix B steps 0–9), renamed dispatch → fabric transport. Exit criterion: §8.24 adversarial two-worker test passes behaviorally. Canonical store = allternit-cowork-runtime SQLite.

### Just did
- All steps 0–9 built and verified; rename commit landed (routes now /api/v1/fabric/transport/*, env ALLTERNIT_FABRIC_TRANSPORT_*, V152–V154 after main took V149).
- LIVE KILL-WORKER DEMO PASSED: A claimed gen 1, checkpointed, SIGKILLed; sweeper requeued; B claimed gen 2, replayed from checkpoint, completed; ghost A completion → 409 A_STALE_LEASE_GENERATION; duplicate → already_committed same result_id; ledger triple intact.
- Merged origin/main (33 commits) to resolve PR #422 conflicts; renumbered migrations V149–V151 → V152–V154.

### Next
- Merge PR #422, attestation, desktop rebuild attempt, then continuation: approval↔lease binding (§8.14), boot job rehydration (§8.20), full §8.24 conformance test → second PR.

### Open questions
- none.

---

## Prior session: desktop-relay-watchdog-0912 (from main, for reference)

- **Goal:** Fix #423 — desktop runtime relay silent-death (node dark until app restart).
- **Just did:** relay heartbeat watchdog in auth-manager.ts; desktop typecheck ✅, 125 vitest ✅, release-preflight 35/0 ✅.
- **Next:** PR → merge → ledger → rebuild desktop DMG.
- **Open questions:** none.
