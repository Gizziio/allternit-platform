# session/cu22-realmodel — real-model batch validation campaign (D3)

- **Date:** 2026-09-13 (~02:00 local)
- **Agent family:** kimi-code (worker timed out at 2h after opening PR; parent landed inline)
- **Spec:** `stagehand-batch-fork` deferral D3 (Brain)
- **PR #466**, merge `ce776d55f`; branch `session/cu22-realmodel`

## What was done
The "real-model batch emission — wired but unexercised" deferral, exercised end to end. Frontier vision model (**gpt-6-astra**, via the authenticated codex CLI brain path — the ak- LLM gateway has no provider key in the dev environment; one real call logged: 31,608 in / 70 out tokens, 7.3 s) drove the planning loop over five task shapes on a local multi-page site, each run batched and forced per-step, ground truth from server-side submission state.

**Headline finding:** steps succeed when batched (28/29 vs per-step 13/14) but **turns were not saved end-to-end** (28 batched vs 13 per-step on completed runs). Cause: the post-batch observation is captured from the operator-facing adapter browser while the batch executes in the grant gate's sidecar browser — the model re-plans against a stale screen and re-batches, amplifying grant requests (12 grants on extract-then-act, a task per-step finishes in 2 turns). The observation disconnect is the next wiring target. The 2026-09-12 "4→2 turns" number used a scripted provider that declared done from the receipt — real models don't.

**Safety:** no got-through — every batch execution was bound to a SHA-256 descriptor grant with a receipt on the trail; instrumented reruns account for every executed action.

**Campaign-found product fixes landed (PR #466):** attribute selectors (`input[placeholder=…]`) ground as batch targets; `select` plans ground to `selectOptionFromDropdown`; batch dispatch grounding for both.

**Named, still-open gaps (documented on the safety card):** per-step executor vocabulary rejects plan types `click`/`select` (campaign shimmed click→left_click; product translation TODO); 60 s `SubprocessVisionProvider` brain timeout too tight for real CLI backends; CLI-brain timeouts orphan the model grandchild process (kill the process tree); observation-browser disconnect (headline); conditional-branch shape stalled on model backend (infrastructure, not a gate failure).

## Verification (first-hand, pre-merge)
- `cargo test -p allternit-api --lib aci_batch`: 28/28
- `pytest tests/test_batch_dispatch.py tests/test_batch_adversarial.py`: 26/26
- Campaign evidence committed at `tmp-cu22-realmodel/evidence/campaign-summary.json` (per-task receipts); safety card updated with the campaign table.

## Incidents
- Worker 2h timeout at PR-open stage; parent verified (Rust 28/28, Python 26/26 re-run), fixed one stale caveat line (record→teach→batch predates PR #447), resolved main-merge checkpoint conflict, landed.
- Model backend stall on conditional-branch (3 hung CLI calls >15 min) — infra, documented.

## Deferrals
Observation-disconnect wiring (next target, named above), D4 code mode (`code-mode-execution.md`).
