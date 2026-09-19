# Steering checkpoint — session/semif-eval

**Goal:** Evaluate SemIf (formerly OpenJev, `TheoLeeCJ/SemIf`, MIT, 1,781★) —
the community open-weights System One reproduction with a new Apple Silicon
MLX backend (direct typed-option scoring, prefix reuse, parallel shared-state
decisions) — as a head behind our `DecisionHead` protocol, measured on the
identical 66 held-out decide steps.

**Just did:** `core/semif_head.py` implemented (SemIf `mlx_backend.score_shared`
— one state prefill + one batched suffix forward for ALL per-step questions;
entropy confidence same as mlx head); `--head semif` wired into
`scripts/shadow_head_eval.py` (suffix `-semif`, budget 15s/step); `semif` note
branch in `core/shadow_eval.py`; `[semif]` extra in pyproject (git install,
not PyPI); `tests/test_semif_head.py` — 13 passed + 1 correct skip, live
shared-pass tests green against the pinned Qwen/Qwen3.5-4B weights.

**Key API facts (README vs code):** package is `semif-phase1`, not `semif`;
mlx backend supports ONLY `qwen3_5` checkpoints (MiniCPM5-2B is web-demo
ladder only — README overstates); options hard-capped at 16 (letters A–P);
remote models require pinned 40-hex revisions; returns per-option probs, NO
confidence (uncalibrated by its own docs).

**Next:** full targeted pytest suite, mock smoke regression, ONE eval pass
`--head semif --steps 22 --quiet` in background, notes doc
`docs/JEV_SEMIF_NOTES.md`, commit + push.

**Open questions:** none — scope frozen.

**Constraints:** no training, one eval pass, kill all background processes,
subagent does not merge. Fair-comparison note: old mlx 0.227 was pre-deltas
state format; SemIf gets the current canonical format.
