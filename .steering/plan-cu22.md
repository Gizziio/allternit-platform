# Plan — session/cu22-realmodel (D3: real-model end-to-end batch validation)

Goal: exercise batch dispatch against a REAL frontier vision model through the allternit
gateway (deferred item from `stagehand-batch-fork` spec), measure a 5+ task-shape campaign
batched vs per-step, publish numbers in `docs/public/aci/safety.md`.

## Todos
- [x] Setup worktree `allternit-cu22` from origin/main
- [ ] A: start stack locally (allternit-api test port :18113 + headless Chrome CDP + local test page)
- [ ] A: gateway smoke — one real frontier-model inference logged (model, tokens, latency). If no
      provider key works → say so explicitly and stop.
- [ ] B: build local multi-page test site (form fill, multi-click nav, select+submit, extract-then-act,
      conditional branch)
- [ ] B: run each task batched + forced per-step; collect steps attempted/completed, model turns,
      grants, receipts, wall time
- [ ] C: update docs/public/aci/safety.md batch subsection with campaign numbers + honest limits
- [ ] Verification: cargo test -p allternit-api --lib aci_batch (28/28), python touched suites,
      node scripts/release-preflight.mjs
- [ ] Landing: push, PR, checks, merge, attestation + LEDGER (detached worktree push to main),
      remove worktrees, delete branches, report

## Quota discipline
Commit early/often; at 90 min stop, push, open PR, report.
