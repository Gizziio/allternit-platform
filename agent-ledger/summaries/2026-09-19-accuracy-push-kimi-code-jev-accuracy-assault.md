# Attestation — session/accuracy-push (90–100% accuracy assault, 3 lanes)

- **Session:** session/accuracy-push (orchestrated; implementation delegated to a coder subagent, all gate claims re-run and report numbers re-read from JSON by the main agent before landing)
- **Date:** 2026-09-19
- **Branch:** `session/accuracy-push` → **PR #709, MERGED** (merge `3287f269e`)
- **Follows:** PR #692 (SemIf). Owner directive this session: push agreement toward 90–100%.

## What was done

Three lanes, one harness, identical 66 held-out steps (deltas on, grafts off):

1. **Trajectory retrieval** — first measurement of the PR #626 `--trajectory` code (cloud kimi).
2. **Self-consistency voting** — `SelfConsistencyHead` wrapper (`--self-consistency K`, `--sc-temperature`), `temperature`/`seed` sampling on the mlx head, per-step `vote_margin`, `--model`/`--revision` swap plumbing, aggregate op-type + target rates on every report.
3. **Model swap matrix** — mlx 4-bit: Qwen3-4B-Instruct control (new state format), Qwen3.5-4B, Gemma-3-4b-it. Six new report pairs.

## Results (n=66, noise SE ≈ 0.056)

| run | joint | op-only | latency/step |
|---|---|---|---|
| kimi + deltas (prior best) | 0.4848 | 0.803 | 16.2 s |
| kimi + trajectory | 0.409 | 0.758 | 13.8 s |
| mlx sc5 / sc9 | 0.227 / 0.227 | 0.652 | 3.5 / 8.8 s |
| mlx Qwen3 control | 0.227 | 0.652 | 0.93 s |
| mlx Qwen3.5-4B | 0.242 | 0.682 | 0.78 s |
| **mlx Gemma-3-4b-it** | **0.349** | **0.773** | 0.97 s |

## Honest verdicts

- **Trajectory: no movement — measured, closed.**
- **Self-consistency: dead on direct-logit heads** (peaked distributions; K=9 = 8.8 s/step for identical decisions). Kept behind flag, not recommended on this head class.
- **Gemma-3-4B is the local-base signal** (+0.121 joint/op over Qwen3 pin, ~2.2 SE, uniform across tasks; first local head to beat cloud kimi zero-shot). Qwen3.5-4B search-flow collapse (0.000) flagged for pre-promotion investigation.
- **Structural cap quantified:** the recorded-LLM reference is ~0.60 reproducible on targets / ~0.80 on op sequences → joint caps ~0.5, op-only ~0.80 against THIS reference. **90–100% requires a fine-tuned model on our trace distribution (Laya/Kaggle lane — owner-approved) or a restated metric (deterministic policy / acted-precision), not more prompt engineering.**

## Verification

- 163 passed / 3 skipped (main-agent re-run; two pre-existing broken collection files confirmed broken at base — ignored, out of scope).
- Report aggregates re-read from JSON; mock smoke green.

## Deferrals

- Laya lane (in flight, separate worktree): zero-shot substrate test + >20-option two-step design + Kaggle fine-tune prep.
- q35 search-flow collapse investigation.
- sc5 report aggregate op-rate predates the aggregate fix (per-step rows present; noted in lane notes).
