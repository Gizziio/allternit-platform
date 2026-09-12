# Steering checkpoint

## session/adispatch-0912 — A:// fabric transport (continuation, post-merge of #422)

### Goal
Owner directives: (1) rename dispatch → fabric transport [DONE, merged in #422];
(2) merge #422 [DONE, 28457d6a6]; (3) continuation: approval↔lease binding (§8.14),
boot rehydration (§8.20), full §8.24 conformance test — SECOND PR, not merged.

### Just did
- V155 cowork_approval_bindings + request/check/grant/deny store fns + HTTP
  (/fabric/transport/jobs/:id/approvals/*, /fabric/transport/approvals/:id/*);
  expiry invalidates bindings (approval.invalidated).
- Boot: expire_downtime_leases + load_persisted_cowork_jobs (queued AND leased);
  Job type extended (lease_id/lease_generation/required_capabilities + FromStr).
- start_run stops at queued; claim CAS moves run → running (§8.2 honesty).
- Tests: 12/12 green incl. test_full_824_sequence_with_approval and
  test_downtime_expiry_recovers_at_boot.
- LIVE full-sequence demo passed: A gen1 → protected step → approval granted →
  killed → gen-1 approval invalidated → B gen2 → A_APPROVAL_INVALID → re-approved
  → completed exactly-once; ghost A → 409; ledger triple intact (bonus: gen-2
  lease also expired/requeued when it lapsed between demo steps — recovery
  worked again).
- Desktop rebuild: ONE attempt failed — session worktree was mid-edit when the
  release sidecar build ran (E0277 etc.); preflight was 35/0. Not retried per
  owner directive; documented in the PR.

### Next
- Push, open PR #2 (do NOT merge). Then cleanup per ritual after owner merges.

### Open questions
- none.

---

## Prior sessions: see agent-ledger/summaries/2026-09-12-1730-adispatch-0912-*.md (PR #422, merged)
