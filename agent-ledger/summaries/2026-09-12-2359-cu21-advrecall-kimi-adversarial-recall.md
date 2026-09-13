# session/cu21-advrecall — adversarial batch-grant recall suite + receipt hash chain

- **Date:** 2026-09-12 (PR raised 2026-09-13 ~04:45Z)
- **Agent family:** kimi-code (worker lost contact on app exit pre-landing; parent session landed inline)
- **Spec:** `stagehand-batch-fork` deferral D2 (Brain)
- **PR #456**, merge `364ceded7`; branch `session/cu21-advrecall`

## What was done
- **Receipt SHA-256 hash chain** over the batch-receipt JSONL trail + `verify_batch_receipt_chain()`: altered, dropped, reordered, injected, legacy, or corrupt records all fail offline verification.
- **One-grant denial parity:** a denied batch at `run_gated_batch` now records a denied batch receipt (same as the per-step denial path).
- **Adversarial suite** (`aci_batch_adversarial.rs`): 35 scripted attack cases across 6 classes — descriptor tampering (any step mutated post-grant), replay (grant redeemed twice), scope widening (append/reorder/binding change), mixed-risk routing (per-step-required steps never silently batched), expiration/expiry races, receipt-chain integrity. **35/35 blocked.**
- **Engine side** (`test_batch_adversarial.py`, 5 tests / 17 assertions): denied retries fail closed, steps stable between attempts, missing receipt fails closed (planning_loop hardened), approval-required kinds never batched.
- **Safety card** (`docs/public/aci/safety.md`): adversarial recall row published (35/35, scripted-adversary caveat) + reproduce commands; "recall not measured" caveat removed.

## Verification (first-hand, pre-merge, this branch)
- `cargo test -p allternit-api --lib aci_batch`: **28/28** (19 gate + 9 adversarial)
- `pytest tests/test_batch_dispatch.py tests/test_batch_adversarial.py`: **25/25**
- CI note: GitHub Actions did not trigger for this branch/PR (repo-wide webhook flakiness at the time; other branches triggered fine; empty-commit retrigger + PR close/reopen did not fire). Merge proceeded on first-hand local verification + green gitleaks/typography/cache-guard. Follow up if this recurs.

## Incidents
- App exit mid-landing detached the worker; parent verified the branch state and landed (push → main-merge conflict, only .steering/checkpoint.md, resolved).

## Deferrals
D3 real-model validation campaign; D4 code mode (`code-mode-execution.md`).
