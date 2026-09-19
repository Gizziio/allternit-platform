# Shadow Head Eval Report

Generated: 2026-09-19T12:15:41-0500

> **Head:** SemIfHead (SemIf community System One reproduction, MIT — Qwen/Qwen3.5-4B pinned, mlx backend, shared-state parallel pass).
> ALL questions for a step score in ONE pass (one state prefill + one
> batched suffix forward). Per-option probabilities are SemIf's declared
> option scores (uncalibrated per its own docs); confidence is the
> entropy-based convention, same as the mlx direct-logit head. Target
> menus truncate at 16 options (SemIf's hard A–P letter cap).

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.2273 |
| Agreement given LLM success | 0.1778 |
| Agreement given LLM failure | 0.3333 |
| Stuck=true rate (all steps) | 0.0 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0 |
| Mean head latency (ms) | 2336.38 |
| Mean LLM latency (ms) | 850.0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3182 | 0.0 | 1.0 | 0.0 | 2160.065 | 850.0 |
| form-fill | 22 | 0.0 | 0.0 | 0.0 | 0.0 | 2876.168 | 850.0 |
| settings-toggle | 22 | 0.3636 | 0.5333 | 0.0 | 0.0 | 1972.907 | 850.0 |

## Method

SemIfHead numbers — SemIf (community System One reproduction, Qwen/Qwen3.5-4B pinned, mlx backend) scores ALL questions for a step in ONE shared-state pass (one state prefill + one batched suffix forward); agreement measures how often its declared-option argmax choices match the recorded LLM decisions. Per-option probabilities are SemIf's conditional option scores (uncalibrated per its own docs); confidence is the same entropy-based convention as the mlx direct-logit head. Target menus truncate at 16 options (SemIf's hard A–P letter cap).
