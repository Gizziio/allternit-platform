# /agent/POLICY.md — A2rchitech Agent Policy (v0)

Generated: 2026-01-27

## Core gates

- No tool calls without WIH.
- No writes outside `/.a2r/`.
- No bypassing dependency DAG.
- All proposals go to `/.a2r/proposals/`.
- Law memory is immutable in runs; changes only via approved deltas.

## Work Item Header (WIH)

- Every node must include WIH/Beads front matter.
- WIH must reference contracts/tests it is bound to.

## Promotion

- Auto-approve allowed when deterministic rules + checks are satisfied.
- Promotions create receipts and diffs; rollback supported.

