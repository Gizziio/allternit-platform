# JEV Accuracy Push — measured results (2026-09-19)

Session `accuracy-push`, branch `session/accuracy-push` (based on
`origin/main` e7815834b, includes SemIf PR #692). Owner directive: push
decision-head agreement toward 90–100%. Zero-shot was measured out before
this session (local mlx 0.227, cloud kimi 0.318, few-shot no movement,
SemIf 0.227); this session fired the three remaining inference-only levers
and measured each. **No training/fine-tuning of any kind was used.**

Eval: same harness as all prior notes — 3 synthetic held-out tasks × 22
decide steps (n=66), agreement vs the recorded-LLM transcript, deltas on
(the `[SINCE LAST STEP]` block is unconditional since PR #626), grafts off.
Reports: `domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-*`.

## Metrics discipline

Every run reports **joint** (strict: op AND target agree),
**op-only** (operation type match), **target** (target agreement on
targeted ops where the head picked the recorded op), and mean head latency.
Self-consistency runs additionally report **agreement@commitment**:
agreement over steps whose vote margin (winner share − runner-up share)
meets τ ∈ {0.0, 0.2, 0.4, 0.6}.

**Structural-cap caveat (owner-mandated, state it plainly):** joint TARGET
agreement is capped by LLM target-choice inconsistency — the recorded
reference itself is not reproducible. Observed across all heads: even the
best run's op-type rate is ~0.80 and its target rate ~0.60, so joint is
structurally capped near ~0.5–0.55 on this eval no matter how good the head
gets. The honest 90–100% target is **acted-precision-with-abstention** and
**op-type agreement**, not raw joint agreement.

## Results — every run

Noise band at n=66: SE ≈ √(0.3·0.7/66) ≈ 0.056 per proportion.

| run | head / config | joint | op-only | target | latency/step |
|---|---|---|---|---|---|
| kimi (pre-delta baseline) | cloud, zero-shot | 0.3182 | 0.7576 | 0.4200 | 27.9 s |
| **kimi + deltas** (PR #626) | cloud, zero-shot | **0.4848** | **0.8030** | 0.6038 | 16.2 s |
| kimi + deltas + graftAB | cloud | 0.4545 | 0.6515 | 0.6977 | 17.7 s |
| mlx (pre-delta, old `-mlx`) | local Qwen3-4B-4bit | 0.2273 | 0.6515 | 0.3488 | 1.7 s |
| SemIf (PR #692) | local Qwen3.5-4B shared-pass | 0.2273 | 0.5606 | 0.4054 | 2.3 s |
| **Lane 1: kimi + trajectory** (`-kimi-traj`) | cloud, `--trajectory on` | 0.4091 | 0.7576 | 0.5400 | 13.8 s |
| **Lane 2: mlx self-consistency K=5** (`-mlx-sc5`) | local, T=0.7 | 0.2273 | 0.6515 | 0.3488 | 3.45 s |
| **Lane 2: mlx self-consistency K=9** (`-mlx-sc9`) | local, T=0.7 | 0.2273 | 0.6515 | 0.3488 | 8.83 s |
| **Lane 3: mlx control rerun** (`-mlx-qwen3`) | local Qwen3-4B-4bit, new format | 0.2273 | 0.6515 | 0.3488 | 0.93 s |
| **Lane 3: mlx Qwen3.5-4B-4bit** (`-mlx-q35`) | local | 0.2424 | 0.6818 | 0.3556 | 0.78 s |
| **Lane 3: mlx Gemma-3-4b-it-4bit** (`-mlx-gemma3`) | local | **0.3485** | **0.7727** | 0.4510 | 0.97 s |

Per-task joint rates: lane 1 (traj): search-flow 0.318, form-fill 0.545
(vs 0.773 with deltas alone), settings-toggle 0.364. Lane 3 gemma3:
0.318 / 0.364 / 0.364 — uniform uplift, no single-task artifact.
q35's search-flow is 0.000 (all 22 steps disagree) — a formatting/vocabulary
mismatch on that task's menu, worth a look before any promotion.

### Lane 2 abstention curves (agreement@commitment)

| τ | sc5 committed | sc5 joint / op | sc9 committed | sc9 joint / op |
|---|---|---|---|---|
| 0.0 | 66/66 | 0.2273 / 0.6515 | 66/66 | 0.2273 / 0.6515 |
| 0.2 | 60/66 | 0.2500 / 0.6667 | 65/66 | 0.2308 / 0.6462 |
| 0.4 | 58/66 | 0.2586 / 0.6897 | 62/66 | 0.2419 / 0.6613 |
| 0.6 | 58/66 | 0.2586 / 0.6897 | 56/66 | 0.2679 / 0.6607 |

## Honest verdict per lane

**Lane 1 — trajectory retrieval (cloud kimi): did not move; mild regression.**
0.4091 vs 0.4848 deltas-only. Δjoint −0.076, Δop −0.045, Δtarget −0.064 —
inside ~1.4 SE of zero, so honest call is "no improvement, direction
slightly negative"; the trajectory block costs latency-neutral but prompt
noise. The `[ACTIONS SO FAR THIS RUN]` wiring itself works end-to-end
(begin_run/note_prior_step hooks engaged, `kimi-cli:traj` model id in every
row, 5 vocab misses) — this session verified and measured it; the lever is
just not productive on this eval.

**Lane 2 — self-consistency voting (local mlx): zero movement; abstention
curve too shallow to matter.** K=5 and K=9 both reproduce greedy exactly
(0.2273/0.6515/0.3488, identical per-task). Sampling did flip individual
votes (margins < 1.0 exist on 8–10 steps) but never the majority outcome —
direct-logit distributions are too peaked for voting to diversify. The
abstention valve buys +0.03 joint at τ=0.6 while dropping 8–10 of 66 steps
(~15% abstention). Acted-precision-with-abstention lands at ~0.26, not
0.90. K=9 costs 8.8 s/step (9 forward passes) for literally the same
decisions — the lever is dead on this head class.

**Lane 3 — model swap matrix (local mlx): the only lane with signal.**
Control confirms the pre-delta `-mlx` number reproduces exactly in the new
format (0.2273). Qwen3.5-4B-4bit: +0.015 joint — noise, plus a search-flow
collapse to 0.000 that looks like a menu-vocabulary mismatch, not a
capability gain. **Gemma-3-4b-it-4bit: +0.121 joint, +0.121 op, +0.102
target over control** (0.3485/0.7727/0.4510) — ~2.2 SE, uniform across all
three tasks; this is the first local-head result that beats the cloud kimi
zero-shot baseline (0.3182) and approaches kimi+deltas op-type (0.8030 vs
0.7727). Still nowhere near 0.90.

## Bottom line vs the 90–100% goal

**Not reachable on this eval as configured, by any of the three levers.**
Best joint after this push: 0.4848 (kimi+deltas, pre-existing). Best this
session produced: gemma3 local 0.3485. The binding constraint is not head
quality — it is the reference: the recorded LLM's own target choices are
only ~0.60 reproducible and its op sequence ~0.80, so joint agreement has a
structural ceiling around ~0.5. The honest 90–100% target must be restated
as op-type agreement or acted-precision-with-abstention on a **better
reference** (re-recorded with a deterministic policy, or scored against
task success rather than transcript replay), and the local head to build on
is gemma-3-4b-it, not the Qwen3 pin. At n=66 every ±0.06 difference is one
SE; treat all deltas smaller than that as noise.

## What changed in code (all on `session/accuracy-push`)

- `core/decision_head.py` — `MlxDirectLogitHead(temperature=, seed=)`:
  T=0 (default) is byte-identical greedy; T>0 samples the option from
  softmax(logits/T). Custom `model_repo` no longer inherits the Qwen3
  commit pin (would 404). `Choice.vote_margin` field (0.0 default, in
  to_dict).
- `core/self_consistency.py` — `SelfConsistencyHead` wrapper: K samples,
  per-question majority vote, confidence = winner share, probabilities =
  vote frequencies, vote_margin recorded; duck-typed passthrough for
  begin_run/note_prior_step/vocab_misses.
- `core/shadow_eval.py` — report rows carry per-step `vote_margin`;
  aggregate + markdown now include `op_agreement_rate` and
  `target_agreement_rate` on every report.
- `scripts/shadow_head_eval.py` — `--self-consistency K`,
  `--sc-temperature` (0.7), `--model HF-REPO`, `--revision`; report stems
  `-mlx-sc<K>` / `-mlx-qwen3|q35|gemma3`.
- `tests/test_self_consistency.py` — vote/margin/tie math, K=1 transparency,
  temperature application, model-pin plumbing, sampler determinism.
- New reports: `shadow-eval-report-kimi-traj`, `-mlx-sc5`, `-mlx-sc9`,
  `-mlx-qwen3`, `-mlx-q35`, `-mlx-gemma3` (JSON + MD).

Verification: `uv run --no-sync python -m pytest tests/ -q -k "element_table
or decision_head or shadow_eval_smoke or shadow_hook or system_one_graft or
trace_recorder or semif_head or self_consistency"` → 142 passed, 6 skipped
(two pre-existing collection-broken files, `test_e2e.py` /
`test_real_adapters.py`, import a nonexistent `sessions` module on
origin/main too — verified by stashing). Mock smoke green after CLI changes.

Deviations: none material — all three lanes ran as specified; `--trajectory`
wiring was already complete (no fix needed); all three lane-3 HF repos
existed as 4-bit builds (no BF16 fallback needed).
