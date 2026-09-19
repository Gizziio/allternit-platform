# Shadow Head Eval Report

Generated: 2026-09-19T14:42:32-0500

> **Head:** mlx (real weights, local mlx-lm inference).
> The LLM side is still the recorded transcript; agreement measures
> head-vs-LLM first-token choice match on identical observations.

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.2273 |
| Op-type agreement rate | 0.6515 |
| Target agreement rate (targeted ops) | 0.3488 |
| Agreement given LLM success | 0.3333 |
| Agreement given LLM failure | 0.0 |
| Stuck=true rate (all steps) | 0.4394 |
| Stuck=true given LLM success | 0.4889 |
| Stuck=true given LLM failure | 0.3333 |
| Goal-satisfied=true rate | 0.4394 |
| Mean head latency (ms) | 927.757 |
| Mean LLM latency (ms) | 850.0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3182 | 0.4667 | 0.0 | 0.0 | 897.99 | 850.0 |
| form-fill | 22 | 0.0 | 0.0 | 0.0 | 0.0 | 1182.489 | 850.0 |
| settings-toggle | 22 | 0.3636 | 0.5333 | 0.0 | 1.0 | 702.792 | 850.0 |

## Method

MlxDirectLogitHead real-weights numbers — the local mlx-lm head answers the same closed-set questions as the scripted LLM transcript; agreement measures how often its first-token choices match the recorded LLM decisions.
