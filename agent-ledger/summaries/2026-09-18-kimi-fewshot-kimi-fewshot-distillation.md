# Attestation — session/kimi-fewshot (kimi-only few-shot distillation lane)

- **Session:** session/kimi-fewshot (orchestrated, executor: kimi K2.8 subagent)
- **Date:** 2026-09-18
- **Branch:** `session/kimi-fewshot` → **PR #617, MERGED**
- **Follows:** PR #580 (KimiCliHead). Eoj direction: kimi-only iteration, no local model training.
- **Spec:** `Allternit Brain/Research/specs/jev-policy-head.md` — queue `rq-20260918-002` (landed)

## What was done

Few-shot in-context distillation for KimiCliHead: exemplar selection from train-split traces only (held-out leak invariant in tests), `--few-shot N`, three prompt-space eval passes on the same 66 held-out steps as the 0.3182 zero-shot baseline. 22 new tests; 87 passed / 1 skipped targeted.

## Results (hypothesis rejected — with data)

| Pass | Agreement | search-flow fill steps (8) |
|---|---|---|
| zero-shot baseline | 0.3182 | 0/8 |
| N=8 random | 0.3333 | 0/8 |
| task-neutral framing | 0.3030 | 0/8 |
| interleaved templates | 0.2879 (policy cracked) | 0/8 |

All passes within ±2 steps of baseline. Pass 3 broke the per-task constant policy and agreed *less* — less collapsed ≠ more correct. The head's operation choice is a task-identity lookup that foreign-task demonstrations cannot interrupt.

## Conclusion for the program

Prompt-space distillation (few-shot count/order/framing) is a **dead end for this collapse**. Missing signal: same-task live-trajectory retrieval and/or state-delta conditioning (needs harness cooperation — emitting per-step deltas — not prompt edits). This is compatible with the kimi-only constraint: retrieval-in-context of the same task's own shadow trace is inference-only. Recorded in spec; next lane if pursued: (1) harness emits state deltas, (2) same-task trace retrieval into the prompt, (3) re-measure. Local-model training remains off the table per Eoj.

## Deferrals

- State-delta emission in shadow_eval / planning_loop (harness change).
- Same-task live-trace retrieval head.
- Live-trace accumulation policy (shadow runs with flag on).
