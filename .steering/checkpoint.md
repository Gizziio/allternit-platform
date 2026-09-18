# Steering checkpoint — session/state-deltas

**Goal:** Land the step-conditioned state lane of the JEV policy-head program:
emit per-step state deltas in the shadow state text and feed the current run's
prior shadow proposals into the KimiCliHead prompt, then re-measure agreement
on the same 66 held-out decide steps vs the 0.318 baseline
(`core/evaluation/shadow-eval/shadow-eval-report-kimi.json`).

**Just did:**
- Parts A + B + C-code implemented and unit-tested: `diff_tables`/`TableDelta`/
  `render_delta_block` in core/element_table.py; `[SINCE LAST STEP]` block
  unconditionally in `_run_shadow_head` (per-run prev-table reset + duck-typed
  `begin_run`/`note_prior_step` hooks in planning_loop.py); KimiCliHead
  trajectory mode (`trajectory=True`, `:traj` model_id suffix, [ACTIONS SO
  FAR THIS RUN] block labeled never-executed); `--trajectory {off,on}` in
  shadow_head_eval.py with `-deltas`/`-traj` report stems (baseline reports
  never overwritten).
- Tests: 86 passed / 1 skipped across test_element_table.py (new TestTableDelta),
  test_decision_head.py (new TestKimiCliHeadTrajectory), test_shadow_hook.py
  (new TestShadowStateDeltas incl. non-vacuousness + same-instance run reset),
  test_shadow_eval_smoke.py (updated stem expectations).
- Mock harness check passed (`--head mock --steps 22 --quiet`, scratch out-dir).
  Throwaway state-text capture: delta block non-empty on 15/44 steps of
  search-flow (1) + form-fill (14); settings-toggle observation is fully
  static so its block is always "no change" (expected — noted for the notes doc).
- Env: `.venv` created in domains/computer-use/core; `uv pip install -e
  '.[shadow-head,dev]'`; `kimi` on PATH at ~/.kimi-code/bin/kimi.

**Next:**
1. First working commit on session/state-deltas + push -u origin.
2. Two kimi runs (~30 min each, background, sequential to avoid CLI rate
   shaping): `--head kimi --steps 22` (deltas; stem `-kimi-deltas`) then
   `--head kimi --steps 22 --trajectory on` (stem `-kimi-traj`).
3. Compare vs 0.318 baseline; write docs/learnings/JEV_STATE_DELTAS_NOTES.md;
   final commit.

**Open questions:**
- `begin_run` receives the loop's session_id (carries "shadow-<task_id>" in the
  eval) because run() has no task_id parameter — documented in code.
- settings-toggle has no scripted observation changes, so deltas cannot move
  anything there; per-task breakdown must say so explicitly.

**Constraints in force:** kimi-iteration only (no local training, no mlx runs);
eval runs in background; commit early on session/state-deltas; I review/PR/
merge, subagent does not merge.
