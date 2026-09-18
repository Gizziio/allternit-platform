---
status: done
date: 2026-09-18
branch: session/jev-real-eval
files_changed:
  - domains/computer-use/core/scripts/shadow_head_eval.py
  - domains/computer-use/core/core/shadow_eval.py
  - domains/computer-use/core/core/planning_loop.py
  - domains/computer-use/core/core/decision_head.py
  - domains/computer-use/core/tests/test_shadow_eval_smoke.py
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-mlx.json
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-mlx.md
  - docs/JEV_REAL_EVAL_NOTES.md
deviations:
  - "uv sync --extra shadow-head is impossible in this checkout: uv.lock predates PR #573 (provides-extras lacks byoc/gateway/mcp/droidrun/mobile/shadow-head) and --frozen validates extras against the lock. Used the documented fallback (uv pip install -e '.[shadow-head]') + `uv run --no-sync` so uv does not uninstall mlx-lm on every invocation. Regenerating uv.lock was rejected: non-frozen resolution is broken here for the pre-existing Python >= 3.15 pyobjc pin reason documented in the Phase 1 notes."
  - "Three pre-existing defects in the Phase 1 wiring had to be fixed before the real numbers meant anything, all verified as defects (not head quality): (1) the shadow state_text never listed the closed-set options, so the mlx head answered from the unconditional token prior — constant answers, 0.0 agreement; (2) the prompt did not end where the answer begins, so the per-option first-token readout measured a discourse prior even after adding options (constant answers again); (3) PlanningLoopConfig.timeout_ms=120_000 silently killed every run mid-task at real-head latencies, and the disk-backed ACU scratchpad (~/.allternit/acu/scratchpad) both inflated the prompt to ~13.7k chars (10-25x slower prefill) and made evals nondeterministic across machines while polluting the operator's real scratchpad."
  - "Fixes: state_text now carries an [OPTIONS] block and ends with the answer lead-in 'The next browser operation is:'; shadow_eval.run_task isolates ACU_SCRATCHPAD_DIR into a temp dir and scales timeout_ms with the transcript; DEFAULT_REVISION is now pinned to the verified commit 50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b with the env override taking precedence over the pin (the previous arg>pin>env ordering would have made SHADOW_HEAD_REVISION dead once the pin landed)."
  - "MockHead numbers are byte-identical before and after all wiring changes (0.7576 agreement etc., re-verified in-session); the new --head flag defaults to mock and the committed mock artifacts in evaluation/shadow-eval/ are untouched."
remaining:
  - "The single-position readout elicits the OPERATION token; the speculative <operation>_target and goal_satisfied/stuck questions are read at the same position and are only weakly conditioned (see observation 4). Per-question prefills or a constrained-decoding answer scaffold are the obvious next experiments."
  - "Eval-created scratchpad entries from earlier non-isolated runs (pre-this-PR) still exist under ~/.allternit/acu/scratchpad/tasks/ (search_for__quarterly_report..., log_in_with_the_saved_operator..., enable_notifications_and_save_the_settings...). Left in place — deleting user data was out of scope — but they are synthetic eval artifacts, safe to remove."
  - "Tier A (151M classifier) training on labelled shadow.decision traces remains Phase 2; these numbers are the strongest argument for it so far."
---

# JEV real-weights eval — shadow policy head (2026-09-18)

Phase 1 deferred the real-weights run ("wire head selection into
scripts/shadow_head_eval.py" was the listed remaining item). This session
wired `--head {mock,mlx}`, fixed three wiring defects that made real numbers
meaningless, and ran the eval with `MlxDirectLogitHead`
(mlx-community/Qwen3-4B-Instruct-2507-4bit, pinned commit
`50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`, mlx-lm 0.31.3 / mlx 0.32.2).

## The numbers (3 tasks × 22 decide steps = 66; LLM side = recorded transcript)

| Metric | MockHead (plumbing) | MlxDirectLogitHead (real) |
|---|---|---|
| Agreement rate | 0.7576 | **0.2273** |
| Agreement given LLM success | 0.7333 | **0.3333** |
| Agreement given LLM failure | 0.8095 | **0.0000** |
| Operation agreement (component) | — | 0.6515 |
| Target agreement (when ops agree) | — | 15/43 = 0.3488 |
| Stuck=true rate (all steps) | 0.3182 scripted | 0.3333 |
| Stuck=true given LLM success | 0.0 | 0.3333 |
| Stuck=true given LLM failure | 1.0 | 0.3333 |
| Goal-satisfied=true rate | 0.0455 | 0.3333 |
| Mean head latency | 8.0 ms (scripted) | **1704 ms** (max 2150) |
| Mean LLM latency | 850.0 ms (scripted) | 850.0 ms (scripted) |

Per task (real head): search-flow 0.3182 / form-fill 0.0000 /
settings-toggle 0.3636. Full data: `shadow-eval-report-mlx.{json,md}`.

## How to reproduce

```bash
cd domains/computer-use/core
# one-time: uv sync cannot add the extra here (stale uv.lock, see
# deviations) — install into the project venv instead:
uv sync --frozen --extra dev
uv pip install -e '.[shadow-head]'
# real head (weights download once ~2.5GB, then fully local):
uv run --frozen --no-sync --extra dev python scripts/shadow_head_eval.py --head mlx --steps 22
# mock comparison (writes the committed shadow-eval-report.* names):
uv run --frozen --no-sync --extra dev python scripts/shadow_head_eval.py --steps 22
# tests:
uv run --frozen --no-sync --extra dev pytest tests/test_element_table.py \
  tests/test_decision_head.py tests/test_shadow_hook.py tests/test_shadow_eval_smoke.py -q
```

## Observations (honest)

1. **The zero-shot head collapses to a constant "click" prior on the
   operation question.** It chose `click` on all 66 steps. The LLM
   transcript is click-heavy (43 click / 23 fill), so operation agreement
   0.6515 is *exactly* the click base rate — the head adds no operation
   signal beyond the constant prior on these tasks. Form-fill (fill-dominant)
   scores 0.0000 for this reason; the disagreement is systematic, not noisy.
2. **Target selection is where the weak real signal lives.** Given the head
   picked the same op as the LLM (43 steps), it matched the LLM's target
   15/43 (34.9%) against ~4-6 candidate rows per step (chance ≈ 20-25%).
   Real but weak — and it never once predicted the target whose scripted
   failure defines the LLM-failure steps, hence agreement-given-failure 0.0.
   On who is right: the LLM is right on every disagreement the harness can
   adjudicate (the recorded actions are the ground-truth successful trace);
   the head's click-everywhere policy would not complete any of the three
   tasks (fill steps are unskippable in search-flow and form-fill).
3. **Head confidence does separate right from wrong, weakly and mostly
   between tasks.** Mean confidence when agreeing 0.898 (n=15) vs 0.721 when
   disagreeing (n=51) — but within a task the confidence is nearly constant
   step-to-step, so as a per-step veto signal it is not usable at these
   entropy levels. It reads as task-difficulty, not step-correctness.
4. **The goal/stuck gates are not conditioned at the operation-eliciting
   readout position.** Both gates show an identical pinned true-probability
   (~0.4487) on average and flat per-step distributions — the model is never
   asked a yes/no question at the readout position, so these columns are
   position priors, not measurements. The 0.3333 stuck rates are that prior
   leaking into the argmax, not calibration. Per-question prefills are the
   fix if gates matter for Phase 2.
5. **The eval infrastructure itself is now trustworthy in a way it wasn't.**
   Before the scratchpad isolation, the state text carried up to ~13.7k
   chars of accumulated cross-run scratchpad context (10-25x slower
   prefill, machine-dependent answers) and every eval run wrote lessons and
   graduated skills into the operator's real scratchpad. With `ACU_SCRATCHPAD_DIR`
   pointed at a temp dir, runs are deterministic and side-effect-free; the
   MockHead numbers being byte-identical across all changes confirms the
   harness, not the head, moved.

## Read

As a decision-maker, this head is not good enough to act on, and the
failure mode is informative rather than fixable by threshold tuning: a
zero-shot 4B direct-logit head on tiny synthetic observations collapses to
an operation prior and cannot even perceive that a form needs filling before
clicking. Confidence (0.90 vs 0.72) and target-above-chance (34.9%) show the
signal the architecture *can* carry, which supports the Tier A plan — train
a small classifier on labelled traces from this same harness — rather than
shipping Tier B zero-shot as a veto gate. The 1.7s mean latency is also 2x
the scripted LLM step (850ms), so even a perfect Tier B head pays a real
per-step cost; Tier A's 151M-class inference would be ~10x cheaper. None of
this blocks the shadow instrumentation: the event vocabulary, conditioning
splits, and report path are all validated end-to-end with real weights now.
