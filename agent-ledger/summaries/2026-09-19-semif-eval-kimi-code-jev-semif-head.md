# Attestation — session/semif-eval (SemIf local System One head)

- **Session:** session/semif-eval (orchestrated; implementation delegated to a coder subagent, all gate claims re-run and verified by the main agent before landing)
- **Date:** 2026-09-19
- **Branch:** `session/semif-eval` → **PR #692, MERGED** (merge `97495ff41`)
- **Follows:** PR #650 (trace accumulation). Spec: `Allternit Brain/Research/specs/jev-policy-head.md` — flip-trigger #1 context (community open-weights; TypeSafe itself still hosted-only).

## What was done

Evaluated SemIf (`TheoLeeCJ/SemIf`, formerly OpenJev, MIT, ~1,781★, active 2026-09-18) — the community open-weights System One reproduction with an Apple Silicon MLX backend — as a head behind our `DecisionHead` protocol, no protocol changes:

- `core/semif_head.py` — `SemIfHead` + pure mapping helpers; uses SemIf's real parallel shared-state API (`mlx_backend.score_shared`: one state prefill + one batched suffix forward for all question menus). `[semif]` optional extra (git install — package is `semif-phase1`, not on PyPI). `--head semif` in the eval harness, stem `-semif`.
- README reality-check (read at upstream ca3ba65f): MLX backend hard-rejects non-qwen3_5 models (MiniCPM5-2B cannot run on it despite README); options hard-capped 2–16 (vs our 64-truncation); **no confidence returned** (scores self-labeled "uncalibrated" — we used our `entropy_confidence` convention); strict pins (mlx-lm git → 0.32.0 in the worktree venv, documented).

## Results — one pass, `--head semif --steps 22`, canonical delta state, grafts off

| head | agreement | latency/step | confidence (right/wrong) |
|---|---|---|---|
| kimi zero-shot | 0.318 | ~16,200 ms | 0.918 / 0.942 (anti-correlated) |
| kimi + deltas (PR #626) | 0.4848 | ~16,200 ms | 0.918 / 0.942 |
| old mlx zero-shot (pre-delta format) | 0.2273 | 1,704 ms | flat |
| **SemIf zero-shot** | **0.2273** | **2,336 ms** | **0.712 / 0.510 — separated** |

Per task: search-flow 0.318 (op 0.64), **form-fill 0.000 (op 0.05 — collapsed)**, settings-toggle 0.364 (op 1.00 / target 0.36).

**Verdict (plain): zero-shot SemIf does not close the local gap — same 0.2273 zero-shot ceiling as our old mlx head, same constant-policy disease (form-fill 0.00). Do not promote.** Two real findings: (1) **entropy confidence separates right/wrong (0.712 vs 0.510)** — the first calibration-shaped signal in the program (directionally correct; n=66, noted without overclaiming); (2) SemIf's one-shared-pass architecture is a better substrate than the old per-option logit head for the trace-trained future.

## Verification (main agent re-run, not subagent claims)

- Targeted pytest suite: **128 passed, 2 skipped**; mock smoke green.
- Report JSON re-read independently: aggregate/per-task/latency/confidence all match the handoff.

## Deferrals / caveats (honest)

- Local tier revisit only WITH trace training data (recorder shipped PR #650; live enablement owner-gated) — zero-shot local is measured out.
- Quantization (4/8-bit) unmeasured — BF16 reference config used (~9GB).
- mlx-lm version in the session venv is SemIf's git pin (0.32.0); both heads still pass live tests; documented in the notes.
