# Delta 0006 — Task Parity RunState + Beads Execution Contract

Date: 2026-01-28

## Summary
- Add Phase-1 task parity runtime (`scripts/taskgraph.py`) for `/install` and `/resume` semantics.
- Persist run state under `/.a2r/run_state/<run_id>.json`.
- Enforce Graph/WIH/Beads alignment at runtime before scheduling nodes.
- Extend RunState/BeadsRunState node status enum to include task parity states.

## Contracts Updated
- `spec/Contracts/RunState.schema.json`
- `spec/Contracts/BeadsRunState.schema.json`

## Runtime Surface
- `/install <graph_id>`: creates run_state + runnable node list.
- `/resume <run_id>`: recomputes runnable nodes from run_state + receipts, deterministic ordering.

## Acceptance Gates
- AT-TASK-0001..0005 (blockedBy, install, resume determinism, receipt requirement, Beads mismatch failure).
