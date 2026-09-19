# Shadow Head Eval Report

Generated: 2026-09-18T22:12:44-0500

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
| Agreement rate | 0.4545 |
| Agreement given LLM success | 0.3556 |
| Agreement given LLM failure | 0.6667 |
| Stuck=true rate (all steps) | 0.0152 |
| Stuck=true given LLM success | 0.0222 |
| Stuck=true given LLM failure | 0.0 |
| Goal-satisfied=true rate | 0.0606 |
| Mean head latency (ms) | 17657.403 |
| Mean LLM latency (ms) | 850.0 |
| Vocab misses | 16 |
| reobserve picks | 7 of 66 steps |
| abstain picks | 4 of 66 steps |
| Reserved-slot pick rate | 0.1667 |
| [LAST ACTION] block | on (effect: confirmed / suspected_noop) |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.3182 | 0.0 | 1.0 | 0.0 | 15726.826 | 850.0 |
| form-fill | 22 | 0.5909 | 0.8667 | 0.0 | 0.0 | 19617.529 | 850.0 |
| settings-toggle | 22 | 0.4545 | 0.2 | 1.0 | 0.0 | 17627.855 | 850.0 |

## Reserved-slot usage (graft A)

| Task | reobserve picks | abstain picks |
|---|---|---|
| search-flow | 4 | 0 |
| form-fill | 1 | 0 |
| settings-toggle | 2 | 4 |

The recorded-LLM reference policy never abstains, so every reserved-slot pick is scored as a disagreement (op_agree=False) — no special-casing.

## Method

KimiCliHead numbers — the kimi CLI subprocess head answers the same closed-set questions as the scripted LLM transcript under a strict JSON contract; agreement measures how often its chosen answers match the recorded LLM decisions. Per-option probabilities are the chosen option at kimi's stated confidence with the remainder split uniformly (confidence-scalar, not a distribution — an mlx/local-tier property).
