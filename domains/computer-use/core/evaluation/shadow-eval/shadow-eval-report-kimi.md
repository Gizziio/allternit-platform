# Shadow Head Eval Report

Generated: 2026-09-18T05:45:46-0500

> **Head:** KimiCliHead (kimi CLI subprocess, cloud-iteration tier; questioning=batched).
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
| Agreement given LLM success | 0.1556 |
| Agreement given LLM failure | 0.6667 |
| Stuck=true rate (all steps) | 0.0 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0 |
| Mean head latency (ms) | 27902.661 |
| Mean LLM latency (ms) | 850.0 |
| Vocab misses | 1 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3182 | 0.0 | 1.0 | 0.0 | 26810.409 | 850.0 |
| form-fill | 22 | 0.3182 | 0.4667 | 0.0 | 0.0 | 30231.565 | 850.0 |
| settings-toggle | 22 | 0.3182 | 0.0 | 1.0 | 0.0 | 26666.009 | 850.0 |

## Method

KimiCliHead numbers — the kimi CLI subprocess head answers the same closed-set questions as the scripted LLM transcript under a strict JSON contract; agreement measures how often its chosen answers match the recorded LLM decisions. Per-option probabilities are the chosen option at kimi's stated confidence with the remainder split uniformly (confidence-scalar, not a distribution — an mlx/local-tier property).
