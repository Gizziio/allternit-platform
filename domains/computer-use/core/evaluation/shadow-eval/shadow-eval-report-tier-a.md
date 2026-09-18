# Shadow Head Eval Report

Generated: 2026-09-18T13:32:59-0500

> **Head:** TierAClassifierHead (trained ModernBERT-base cross-scorer, core/tier_a_head.py; local CPU inference, no network).
> The LLM side is still the recorded transcript; agreement measures how often the trained softmax choice (an explicit __abstain__ pseudo-option always in the menu) matches the recorded LLM decisions on the three canonical held-out tasks.

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.2424 |
| Agreement given LLM success | 0.3556 |
| Agreement given LLM failure | 0.0 |
| Abstain rate | 0.0 |
| Stuck=true rate (all steps) | 0.0 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0 |
| Mean head latency (ms) | 19.826 |
| Mean LLM latency (ms) | 850.0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3636 | 0.5333 | 0.0 | 0.0 | 37.982 | 850.0 |
| form-fill | 22 | 0.0 | 0.0 | 0.0 | 0.0 | 12.055 | 850.0 |
| settings-toggle | 22 | 0.3636 | 0.5333 | 0.0 | 0.0 | 9.442 | 850.0 |

## Method

TierAClassifierHead numbers — the trained ModernBERT-base cross-scorer answers the same closed-set questions as the scripted LLM transcript; agreement measures how often its softmax choice (an explicit __abstain__ pseudo-option always in the menu) matches the recorded LLM decisions on the three canonical held-out tasks.
