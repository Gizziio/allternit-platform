# session/cu19-batchmeasure — P3: measured batch conformance published on the ACI safety card

- **Date:** 2026-09-12
- **Agent family:** kimi-code (parent session, inline — no subagent)
- **Spec:** `Allternit Brain/Research/specs/stagehand-batch-fork.md` P3
- **PR #434**, merge `15817b3a2`; docs-only (`docs/public/aci/safety.md`)

## What was done
Published the batch-dispatch measurement on the safety/eval system card: new "Batch dispatch (measured 2026-09-12)" subsection — grant gate 19/19 (`cargo test -p allternit-api --lib aci_batch`), engine dispatch 17/17 (`tests/test_batch_dispatch.py`), live gated batch 16/16 (from PR #433's real-stack run, cited), turns-per-task 4→2 on the canned 3-step task. Honest caveats recorded: small n, scripted provider (no frontier vision model), no adversarial batch-grant recall, record→teach→batch deferred. Reproduce commands added. Suites intentionally documented outside `adapter_grades.json` (they live in the Rust crate + pytest tree, not `conformance/suites.py`).

## Verification (first-hand, this branch)
- `cargo test -p allternit-api --lib aci_batch`: 19/19
- `pytest tests/test_batch_dispatch.py`: 17/17
- CI: all code checks pass; Vercel previews red on account-wide build rate limit (pre-existing, same as PR #433); Cloudflare Pages pass.

## Notes
Closes P1–P3 of the spec. Remaining deferrals (in spec): record→teach→batch, real-model batch emission, automatic page binding, adversarial recall, one-shot aci flake identification, P4 code mode (separate spec).
