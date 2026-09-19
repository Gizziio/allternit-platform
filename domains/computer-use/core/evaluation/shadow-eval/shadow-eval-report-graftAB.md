# Shadow Head Eval Report

Generated: 2026-09-18T21:52:49-0500

> **Head:** MockHead (scripted stand-in for the mlx-lm direct-logit head).
> Agreement numbers validate the eval plumbing offline; they are NOT
> measurements of real head quality (weights are not downloaded in-session).

## Aggregate

| Metric | Value |
|---|---|
| Tasks | 3 |
| Total decide steps | 66 |
| Min decide steps per task | 22 |
| Agreement rate | 0.7576 |
| Agreement given LLM success | 0.7333 |
| Agreement given LLM failure | 0.8095 |
| Stuck=true rate (all steps) | 0.3182 |
| Stuck=true given LLM success | 0.0 |
| Stuck=true given LLM failure | 1.0 |
| Goal-satisfied=true rate | 0.0455 |
| Mean head latency (ms) | 8.0 |
| Mean LLM latency (ms) | 850.0 |
| reobserve picks | 0 of 66 steps |
| abstain picks | 0 of 66 steps |
| Reserved-slot pick rate | 0.0 |
| [LAST ACTION] block | on (effect: confirmed / suspected_noop) |

## Per task

| Task | Steps | Agreement | Agree (LLM ok) | Agree (LLM fail) | Stuck (fail) | Head ms | LLM ms |
|---|---|---|---|---|---|---|---|
| search-flow | 22 | 0.5909 | 0.4667 | 0.8571 | 1.0 | 8.0 | 850.0 |
| form-fill | 22 | 0.8636 | 0.8667 | 0.8571 | 1.0 | 8.0 | 850.0 |
| settings-toggle | 22 | 0.8182 | 0.8667 | 0.7143 | 1.0 | 8.0 | 850.0 |

## Reserved-slot usage (graft A)

| Task | reobserve picks | abstain picks |
|---|---|---|
| search-flow | 0 | 0 |
| form-fill | 0 | 0 |
| settings-toggle | 0 | 0 |

The recorded-LLM reference policy never abstains, so every reserved-slot pick is scored as a disagreement (op_agree=False) — no special-casing.

## Method

MockHead plumbing numbers — scripted head agrees with the scripted LLM transcript except deterministic disagreements; real agreement needs the mlx-lm head weights.
