# Shadow Head Eval Report

Generated: 2026-09-18T10:58:01-0500

> **Head:** TierAClassifierHead (trained ModernBERT-base cross-scorer, core/tier_a_head.py; local CPU inference, no network).
> The LLM side is still the recorded transcript; agreement measures how often the trained softmax choice (an explicit __abstain__ pseudo-option always in the menu) matches the recorded LLM decisions on the three canonical held-out tasks.

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.1212 |
| Agreement given LLM success | 0.1778 |
| Agreement given LLM failure | 0.0 |
| Abstain rate | 0.0 |
| Stuck=true rate (all steps) | 0.0 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0 |
| Mean head latency (ms) | 739.794 |
| Mean LLM latency (ms) | 850.0 |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.0 | 0.0 | 0.0 | 0.0 | 601.345 | 850.0 |
| form-fill | 22 | 0.0 | 0.0 | 0.0 | 0.0 | 861.002 | 850.0 |
| settings-toggle | 22 | 0.3636 | 0.5333 | 0.0 | 0.0 | 757.034 | 850.0 |

## Method

TierAClassifierHead numbers — the trained ModernBERT-base cross-scorer answers the same closed-set questions as the scripted LLM transcript; agreement measures how often its softmax choice (an explicit __abstain__ pseudo-option always in the menu) matches the recorded LLM decisions on the three canonical held-out tasks.
