# Shadow Head Eval Report

Generated: 2026-09-19T15:05:57-0500

> **Head:** MockHead (real weights, local mlx-lm inference).
> The LLM side is still the recorded transcript; agreement measures
> head-vs-LLM first-token choice match on identical observations.

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.2273 |
| Agreement given LLM success | 0.3333 |
| Agreement given LLM failure | 0.0 |
| Stuck=true rate (all steps) | 1.0 |
| Stuck=true given LLM success | 1.0 |
| Stuck=true given LLM failure | 1.0 |
| Goal-satisfied=true rate | 1.0 |
| Mean head latency (ms) | 0.004 |
| Mean LLM latency (ms) | 850.0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3182 | 0.4667 | 0.0 | 1.0 | 0.003 | 850.0 |
| form-fill | 22 | 0.0 | 0.0 | 0.0 | 1.0 | 0.004 | 850.0 |
| settings-toggle | 22 | 0.3636 | 0.5333 | 0.0 | 1.0 | 0.003 | 850.0 |

## Method

MlxDirectLogitHead real-weights numbers — the local mlx-lm head answers the same closed-set questions as the scripted LLM transcript; agreement measures how often its first-token choices match the recorded LLM decisions.
