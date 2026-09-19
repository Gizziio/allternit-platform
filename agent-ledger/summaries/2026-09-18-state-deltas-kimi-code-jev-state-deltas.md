# Attestation — session/state-deltas (JEV shadow-head step-conditioned state)

- **Session:** session/state-deltas (orchestrated; implementation delegated to a coder subagent, reviewed + fixed + landed by main agent)
- **Date:** 2026-09-18
- **Branch:** `session/state-deltas` → **PR #626, MERGED** (merge `7344c74a0`)
- **Follows:** PR #617 (kimi few-shot, hypothesis rejected). Spec: `Allternit Brain/Research/specs/jev-policy-head.md`, queue `rq-20260918-002` (landed).

## What was done

Step-conditioned state lane, two parts:

1. **`[SINCE LAST STEP]` delta block** — canonical shadow state text now diffs consecutive element tables by row identity `(role, name, ref_id)`; ADDED/REMOVED/CHANGED-value rows render between `[TASK]` and `[OBSERVED ELEMENTS]` (cap 30/class, `+N more`, `+`/`-`/`~` prefixes so delta lines can't be misparsed as table rows). Unconditional; first step and no-change render explicit lines. New: `TableDelta`/`diff_tables`/`render_delta_block` in `domains/computer-use/core/core/element_table.py`; wiring + per-run prev-table reset + duck-typed `begin_run`/`note_prior_step` hooks in `core/planning_loop.py`.
2. **KimiCliHead live-trajectory mode** — head's own prior shadow proposals render as `[ACTIONS SO FAR THIS RUN]` (explicitly labeled never-executed), last-10 cap, `--trajectory {off,on}` (default off), `:traj` model_id suffix. **Implemented but deliberately UNMEASURED** — the second eval was killed mid-run on owner directive (CPU/time budget); the feature is flag-gated off and must not be treated as validated.

Fix before landing: `diff_tables` `changed` ordering came from a set intersection (arbitrary order) — caught by `test_one_line_lists_few_changed_rows`; fixed to iterate in current-table row order.

## Results — same 66 held-out decide steps, same 3 synthetic tasks, `--head kimi --steps 22`

| run | agreement | given LLM success | given LLM failure |
|---|---|---|---|
| baseline (`shadow-eval-report-kimi.json`) | 0.318 | — | — |
| **+ state deltas** (`shadow-eval-report-kimi-deltas.json`) | **0.4848** | 0.356 | 0.762 |

Per task: search-flow 0.318 → 0.318, form-fill 0.318 → 0.773, settings-toggle 0.364 → 0.364. +0.167 ≈ 3× the ~0.06 noise band at n=66 — signal, and the entire gain lands in form-fill (the task whose state visibly changes per step), exactly as the step-conditioned-state hypothesis predicts. Calibration caveat, honest: self-reported confidence still does not separate right from wrong (mean 0.92 right / 0.94 wrong) — promotion thresholds still require our own labeled traces, never vendor confidence.

## Verification

- `pytest tests/test_element_table.py tests/test_decision_head.py tests/test_shadow_eval_smoke.py` — **73 passed, 1 skipped** (main agent re-run post-fix; subagent's "86 passed" claim did not hold — one ordering failure).
- Delta non-vacuousness on scripted trees covered in tests (`TestShadowStateDeltas`); mock harness check passed.
- Full write-up: `docs/JEV_STATE_DELTAS_NOTES.md`.

## Incidents / deferrals (honest)

- Trajectory-variant measurement: killed mid-run per owner directive; code landed flag-gated off. Deferral, not a result.
- Live trace accumulation (`shadow_head_enabled=true` in real runs) for calibration thresholds: still unwritten policy — deferred.
- One subagent discrepancy (test-count claim vs reality) — caught by main-agent re-run; noted for future delegation briefs (always re-verify gate claims).
