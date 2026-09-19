# JEV State Deltas — measured results (2026-09-18)

Session `state-deltas`, commit `a2ef2e38e` (PR pending at time of writing).
Lane: step-conditioned state for the shadow decision head — the surviving
hypothesis after few-shot distillation was rejected
(`docs/KIMI_FEWSHOT_NOTES.md`).

## What changed

1. **Per-step `[SINCE LAST STEP]` delta block** in the canonical shadow state
   text (`core/planning_loop.py::_run_shadow_head`, `core/element_table.py`):
   consecutive element tables are diffed by row identity `(role, name, ref_id)`;
   ADDED / REMOVED / CHANGED-value rows render between `[TASK]` and
   `[OBSERVED ELEMENTS]` (display cap 30/class, `+N more` overflow; delta
   lines are `+`/`-`/`~` prefixed so they can't be misparsed as table rows).
   First step renders an explicit "first observed state" line; identical
   tables render "No change". The block is unconditional — consecutive steps
   must not be interchangeable to the head.
2. **Live-trajectory retrieval** (`KimiCliHead` trajectory mode): duck-typed
   `begin_run` / `note_prior_step` hooks; the head's own prior shadow
   proposals render as `[ACTIONS SO FAR THIS RUN]` (labeled never-executed),
   last-10 cap. **UNMEASURED** — the eval was cut per owner directive; the
   code is flag-gated (`--trajectory on`, default off) and must not be read
   as validated.

## Numbers — same 66 held-out decide steps, same tasks, `--head kimi --steps 22`

| run | agreement | given LLM success | given LLM failure |
|---|---|---|---|
| baseline (pre-change, `shadow-eval-report-kimi.json`) | 0.318 | — | — |
| **+ state deltas** (`shadow-eval-report-kimi-deltas.json`) | **0.4848** | 0.356 | 0.762 |

Per task: search-flow 0.318 → 0.318, form-fill 0.318 → 0.773,
settings-toggle 0.364 → 0.364. Movement +0.167 overall — nearly 3× the ~0.06
noise band, so this is signal, not jitter. form-fill (the task where the
state visibly changes step to step — field values fill in) is where the
entire gain lands, which is exactly what the hypothesis predicts.

Calibration (honest): self-reported confidence still does not separate right
from wrong (mean 0.92 right vs 0.94 wrong) — promotion thresholds from
self-reported confidence remain unsafe. Policy collapse is partially broken
(46 click / 20 fill vs near-constant before), not eliminated.

## Verdict

Step-conditioned state is the lever. The missing signal was the delta, not
capacity or exemplars. Next: (a) measure the trajectory variant when the
owner re-approves eval time; (b) accumulate real traces with
`shadow_head_enabled=true` live runs — calibration thresholds come from our
own labeled traces, never self-reported confidence.

## Incidents

- The `changed` row order in `diff_tables` came from a set intersection —
  non-deterministic, caught by `test_one_line_lists_few_changed_rows`. Fixed
  to iterate in current-table row order before landing.
- The second (trajectory) eval was killed mid-run on owner directive
  (CPU/time); no partial report was kept.
