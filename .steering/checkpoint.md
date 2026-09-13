# Checkpoint — session/cu22-realmodel

**Goal:** D3 — real-model (frontier vision) end-to-end validation campaign for batch dispatch.

**Just did:** Campaign complete (9/10 runs; conditional-branch stalled on codex backend — infra, documented). Deliverable C landed: `docs/public/aci/safety.md` real-model campaign section + Brain spec deferral updated (both pushed). Product fixes: attribute-selector + select grounding in `batch_dispatch.py` (21/21 tests). Verification: cargo aci_batch 28/28, python batch suites 49+21 passed, preflight 35/0.

**Headline finding:** turns NOT saved end-to-end (28 batched vs 13 per-step) — post-batch observation reads the adapter browser, batch executes in the sidecar browser → stale observation → re-batching → grant amplification (12 grants on extract-then-act). No got-through; every batch execution hash-grant-bound with receipts.

**Next:** PR → checks → merge → attestation + LEDGER (detached worktree push to main) → cleanup worktrees/processes.

**Open questions:** none blocking.
