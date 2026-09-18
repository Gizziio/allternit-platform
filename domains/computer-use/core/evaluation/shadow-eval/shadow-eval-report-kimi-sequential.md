# Shadow Head Eval Report

Generated: 2026-09-18T06:50:30-0500

> **Head:** KimiCliHead (kimi CLI subprocess, cloud-iteration tier; questioning=sequential).
> kimi answers a strict JSON contract per pass; per-option probabilities
> are the chosen option at its stated confidence with the remainder split
> uniformly (confidence-scalar, not a distribution — an mlx/local-tier
> property). Non-canonical answers are folded to the whitelist vocabulary
> and counted as vocab misses.

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.3182 |
| Agreement given LLM success | 0.1778 |
| Agreement given LLM failure | 0.619 |
| Stuck=true rate (all steps) | 0.0 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0 |
| Mean head latency (ms) | 58199.131 |
| Mean LLM latency (ms) | 850.0 |
| Vocab misses | 0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.2727 | 0.0 | 0.8571 | 0.0 | 53374.902 | 850.0 |
| form-fill | 22 | 0.3636 | 0.5333 | 0.0 | 0.0 | 46901.691 | 850.0 |
| settings-toggle | 22 | 0.3182 | 0.0 | 1.0 | 0.0 | 74320.8 | 850.0 |

## Method

KimiCliHead numbers — the kimi CLI subprocess head answers the same closed-set questions as the scripted LLM transcript under a strict JSON contract; agreement measures how often its chosen answers match the recorded LLM decisions. Per-option probabilities are the chosen option at kimi's stated confidence with the remainder split uniformly (confidence-scalar, not a distribution — an mlx/local-tier property).
