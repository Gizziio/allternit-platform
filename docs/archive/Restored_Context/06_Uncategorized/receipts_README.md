# Rails Receipts

Receipts are SHA-bound, immutable proofs of gate evaluation.

## Required receipts
- GateReceipt: one per gate invocation
- MergeEligibilityReceipt (MER): emitted only when all required gates PASS for the given tier

## Storage
Store under an append-only path such as:
`rails/receipts/{headSha}/...`

## Verification
A merge is permitted only if a valid MER exists for the current headSha.
