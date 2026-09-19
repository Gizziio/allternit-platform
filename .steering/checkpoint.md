# Steering checkpoint — session/semif-eval

**Goal:** Evaluate SemIf (formerly OpenJev, `TheoLeeCJ/SemIf`, MIT, 1,781★) —
the community open-weights System One reproduction with a new Apple Silicon
MLX backend (direct typed-option scoring, prefix reuse, parallel shared-state
decisions) — as a head behind our `DecisionHead` protocol, measured on the
identical 66 held-out decide steps.

**Just did:** lane COMPLETE and pushed (2 commits on `session/semif-eval`,
33c2f95d2 + ccc5174ef). SemIfHead implemented (`core/semif_head.py`, one
`score_shared` pass per step), `--head semif` wired, `[semif]` extra, tests
green (128 passed / 2 skipped), mock smoke green. ONE eval pass done:
**agreement 0.2273** (search 0.318 / form-fill 0.000 / settings 0.364),
2.34 s/step — vs kimi-deltas 0.4848 same format. Notes:
`docs/JEV_SEMIF_NOTES.md`; reports: `shadow-eval-report-semif.{json,md}`.
Upstream clone removed, no leftover processes.

**Key API facts (README vs code):** package is `semif-phase1`, not `semif`;
mlx backend supports ONLY `qwen3_5` checkpoints (MiniCPM5-2B is web-demo
ladder only — README overstates); options hard-capped at 16 (letters A–P);
remote models require pinned 40-hex revisions; returns per-option probs, NO
confidence (uncalibrated by its own docs). mlx-lm moved to SemIf's git pin
(0.32.0) in the worktree venv.

**Next:** owner review; lane intentionally NOT merged (no PR per directive).

**Open questions:** none — scope frozen.

**Constraints:** no training, one eval pass, kill all background processes,
subagent does not merge. Fair-comparison note: old mlx 0.227 was pre-deltas
state format; SemIf gets the current canonical format.
