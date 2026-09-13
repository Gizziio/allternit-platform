# Plan CU21 — adversarial batch-grant recall measurement (D2 of stagehand-batch-fork)

Goal: measure batch-grant recall against a scripted adversary, fix small gaps found, publish numbers.

## Deliverable A — adversarial suite
- [ ] A1 production: receipt hash chain on batch-receipts JSONL + `verify_receipt_chain` (attack class 6 needs a real verification surface)
- [ ] A2 production: one-grant denial at `run_gated_batch` records a denied batch receipt (per-step denial already does; class 5 requires the rejection receipt)
- [ ] A3 `cmd/allternit-api/src/aci_batch_adversarial.rs` — 6 attack classes as real tests with an attack ledger that fails the suite if anything gets through:
  1. descriptor tampering (method/selector/args/order/drop/dup per-step)
  2. replay (grant, batch, per-step grant)
  3. scope widening (append/reorder/origin/session/pageUrl + pipeline-level executor-not-invoked)
  4. mixed-risk routing (never silently one-grant; per-step grants index/payload-bound)
  5. expiration/expiry (expired → denied + denied receipt written; pipeline-level too)
  6. receipt integrity (chain verify ok; file tamper → verify fails: altered field, dropped line, reordered lines, foreign append, legacy record)
- [ ] A4 Python engine adversarial tests mirroring the invariants (test_batch_dispatch.py patterns)

## Deliverable B — publish
- [ ] docs/public/aci/safety.md batch subsection: adversarial recall row + reproduce command + honest caveat (scripted adversary, not trained attacker)

## Verify
- [ ] cargo test -p allternit-api --lib aci_batch (19 old) + adversarial suite green; full aci_ filter clean x2
- [ ] pytest before/after counts (17 → N)
- [ ] node scripts/release-preflight.mjs

## Land
- [ ] push, PR, merge, attestation + LEDGER (detached worktree push to main), remove ALL cu21 worktrees incl ledger/baseline, delete branch local+remote
