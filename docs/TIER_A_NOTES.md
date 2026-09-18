---
status: done
date: 2026-09-18
branch: session/tier-a-classifier
files_changed:
  - domains/computer-use/core/core/tier_a_head.py
  - domains/computer-use/core/core/tier_a_traces.py
  - domains/computer-use/core/core/decision_head.py
  - domains/computer-use/core/core/shadow_eval.py
  - domains/computer-use/core/core/planning_loop.py
  - domains/computer-use/core/pyproject.toml
  - domains/computer-use/core/scripts/shadow_head_eval.py
  - domains/computer-use/core/scripts/tier_a_make_traces.py
  - domains/computer-use/core/scripts/tier_a_train.py
  - domains/computer-use/core/tests/test_tier_a_head.py
  - domains/computer-use/core/evaluation/tier-a/traces.jsonl
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-tier-a.json
  - domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-tier-a.md
  - docs/TIER_A_NOTES.md
deviations:
  - "Held-out agreement is 0.2424, BELOW the kimi-cli baseline (0.3182) — reported truthfully per the brief's honest-numbers rule, with the diagnosis below. The brief said 'prove a small trained classifier beats them'; on the canonical static-state eval that proof does not hold, and the reason is structural (constant per-task states cap ANY deterministic head below kimi's number unless it resolves one specific unseen-name menu)."
  - "Frozen encoder as the default training regime, not end-to-end fine-tuning: the brief asked for trained CE+Brier with early stopping and temperature scaling, which is what ships; but end-to-end CPU fine-tuning of ModernBERT measured ~10s/optimizer step (~15 min/epoch) and a 2-epoch trial showed no val gain over the frozen regime (val_ce 0.5633->0.5818 vs frozen ~0.55) before the process was OOM-killed. Frozen encoder + trained scorer is the documented default (--tune-encoder remains for larger live-trace data)."
  - "The head volunteers <op>_target choices the harness did not ask for when exactly one element row supports the chosen op (the loop only asks target menus with >= 2 candidates). Without this, a correct 'fill' on the single-field canonical search task scores target_agree=False because the question was never asked (harness asymmetry). This is a head-side protocol addition, documented in core/tier_a_head.py; without it Tier A scores 8/66 (0.1212) instead of 16/66 (0.2424)."
  - "uv environment: same sanctioned fallback as the prior phases (stale uv.lock predates the tier-a extra): uv sync --frozen --extra dev + uv pip install -e '.[tier-a]' + uv run --frozen --no-sync."
  - "traces.jsonl is force-added (.gitignore ignores *.jsonl): the committed file is the exact experiment record (seed 42, no name-mixing). Regenerate with scripts/tier_a_make_traces.py."
  - "Name-mixing augmentation (randomized control-row names to force structure policies) was implemented and HURT (canonical agreement 0.2424 -> 0.1212, val op accuracy 0.67 -> 0.51): the mixed states read as alien to the frozen encoder and degraded the pool-name generalization the canonical eval needs. It is available via --train-mixes but ships disabled (0)."
remaining:
  - "Held-out agreement 0.2424 < kimi 0.3182: the 5-step gap is ONE menu — form-fill's fill_target, where the head abstains (0.597) on the unseen canonical names (Email/Password) instead of resolving 'first text field'. Gap-to-ceiling analysis: with form resolved, agreement would be 24/66 = 0.3636, the information-theoretic ceiling for this harness (see below)."
  - "Live-trace retraining path: replace scripted variant traces with labelled shadow.decision events from real runs (state_text now varies per step on live pages), at which point --tune-encoder becomes worth its cost and the phase-conditioning the frozen encoder can't generalize (val op accuracy 0.67 on held-out variant states) becomes learnable from the trace distribution itself."
  - "The trained bundle (~600MB ModernBERT + scorer) lives in ~/.allternit/shadow-head/tier-a and is NOT committed; scripts/tier_a_train.py reproduces it in ~45s from the committed traces."
---

# Tier A trained classifier head — shadow policy head (2026-09-18)

Phase 1 + the mlx/kimi sessions shipped the shadow head with two zero-shot
tiers that both collapse to constant policies (mlx 0.2273 agreement, kimi-cli
0.3182). This session builds **Tier A**: a trained 151M-class classifier
(`answerdotai/ModernBERT-base`, Apache-2.0, ungated) behind the same
`DecisionHead` protocol, with its own labelled-trace pipeline, training
script, eval wiring, and tests.

## What was built

**`core/tier_a_head.py`** — `TierAClassifierHead`:
- Row-structured cross-scorer. The state prompt decomposes into a task line
  plus an indexed element table; the state vector is
  `[task_vec ; sum(status-row vecs) ; sum(control-row vecs)]`, each block
  mean+max pooled from ModernBERT-base (frozen by default). Every menu
  option (with an always-present `__abstain__` pseudo-option last) is
  encoded and scored by a small bilinear MLP (`[u; v; u*v]`, inner dim 256),
  softmaxed, entropy -> confidence. Target options (bare row indices) are
  rendered as `<index> (<role>: <name>)` — a bare index carries no semantics.
- Volunteers a forced `<op>_target` choice when the chosen op has exactly
  one supporting row and the harness did not ask (see deviations).
- Inference: one fused encoder forward per decision with state/option
  encoding caches (the harness re-presents identical state text every step
  of a static task). **~2 ms warm, ~20 ms mean** per decision on CPU.
- Persistence: bundle (model + tokenizer + scorer + learned temperature +
  metrics.json) in `~/.allternit/shadow-head/tier-a` (env
  `SHADOW_HEAD_TIER_A_DIR`); clear actionable error when untrained/missing.
  Lazy imports behind the `tier-a` extra (torch CPU + transformers, no CUDA
  pins); zero network at inference.

**`core/tier_a_traces.py`** — labelled trace pipeline. A recording head runs
each scripted task through the REAL PlanningLoop, so captured
(state_text, questions) are byte-identical to a live eval pass; gold comes
from the recorded-LLM transcript (the distillation target). 22 parameterized
task variants (search/form/settings templates with different names, phrases,
distractors, cycle shapes) get DYNAMIC per-step observations — the AX tree
mutates per cycle phase (results populate, dropdowns open, progress markers
appear). Without this the state text is constant within a task (verified: 1
unique state per canonical task) and no classifier can beat a per-task modal
policy. The 3 canonical eval tasks are held out; variant name pools are
asserted disjoint from every canonical name.

**`scripts/tier_a_make_traces.py` / `scripts/tier_a_train.py`** — trace
generation (deterministic, seed 42) and training (frequency-weighted CE +
Brier over deduped groups, AdamW, early stopping on val CE, temperature
scaling on val, seed fixed; ~45 s on CPU frozen).

**Eval wiring** — `--head tierA` in `scripts/shadow_head_eval.py`; the
report carries an abstain-rate column; `build_shadow_questions` /
`build_shadow_state_text` were extracted into `core/shadow_eval.py` and are
now shared verbatim between the planning loop and trace generation (mock
numbers byte-identical, re-verified).

## Data

| Split | Steps | Source |
|---|---|---|
| train | 419 | 18 task variants (6-7 per template), 20-28 steps each, dynamic observations |
| val | 94 | 4 held-out variants (early stopping + temperature scaling) |
| heldout | 66 | the 3 canonical eval tasks (22 steps each) — never trained on |
| total | 579 | 3576 question menus, 36% abstain-labelled (speculative target menus) |

Deduped: 360 unique train groups / 81 val (weighted by trace frequency).

## Training config (shipped bundle)

Frozen ModernBERT-base + slim bilinear scorer (scorer-only training,
`scorer_lr=1e-3`, encoder frozen); 20 epochs max, early stopping patience 3
(6 epochs run); batch 32 groups; CE + 0.5*Brier; seed 42; temperature
learned on val = **1.3054**. Val metrics: overall accuracy **0.766**
(operation 0.670, target 0.765, gate 0.814), abstain rate 0.406.

## Held-out numbers — the honest table (3 canonical tasks x 22 steps = 66)

| Metric | MlxDirectLogitHead | KimiCliHead (batched) | **TierAClassifierHead** |
|---|---|---|---|
| Agreement rate | 0.2273 | **0.3182** | 0.2424 |
| Agreement given LLM success | 0.3333 | 0.1556 | 0.3556 |
| Agreement given LLM failure | 0.0000 | 0.6667 | 0.0000 |
| Operation agreement | 0.6515 | 0.7576 | 0.5303 |
| Target agreement (ops agree) | 0.3488 | 0.4200 | 0.3636 |
| Per task | 0.32/0.00/0.36 | 0.32/0.32/0.32 | **0.36/0.00/0.36** |
| Mean head latency / step | 1704 ms | 27 903 ms | **20 ms** |
| Abstain rate (operation) | n/a | n/a | 0.0 |

Per task Tier A: search-flow 0.3636 (at ceiling: 8 fill steps agreed via the
volunteered forced target, target agreement 1.0 on those steps), form-fill
0.0000 (fill_target abstains on unseen names), settings-toggle 0.3636
(at ceiling: click+Theme on all 22 steps, matching on 8). Stable across
seeds 42/7/123 (0.2424/0.2424/0.2273).

## Why 0.2424 and not higher — the ceiling analysis

The canonical tasks present the SAME state text on every step (the scripted
AX trees differ only in hidden field values, and the prompt format hides
values behind names — verified empirically). A deterministic head therefore
outputs one policy per task, and the best achievable agreement is the
per-task modal (operation, target) frequency: search 8/22 (fill, via a
volunteered target — a click policy caps at 7/22), form 8/22 (fill+Email),
settings 8/22 (click+Theme) = **24/66 = 0.3636**. Kimi's 0.3182 (21/66) is
already 88% of that ceiling; its per-task constant click policies happen to
score on the click-heavy tasks. Tier A reaches the ceiling on two tasks and
loses all 8 form steps to ONE failure: `fill_target` abstains (0.597) on
the unseen canonical names instead of resolving "first text field". Had it
resolved, Tier A would be 24/66 = 0.3636 > 0.3182.

## What training actually bought (and what it didn't)

- Latency: 20 ms vs 1.7 s (mlx) / 27.9 s (kimi) per step — the only head
  cheap enough to run inline as a gate.
- Real per-option distributions + a calibrated abstain mechanism (0.406
  abstain rate on val-variant targets, exactly the speculative menus).
- Genuine state conditioning on dynamic states: on held-out VARIANT states
  (which do change per step) the trained head reaches 0.77 agreement vs the
  recorded policy, where both zero-shot heads collapse to constants. The
  frozen encoder generalizes phase semantics at the row level (row
  embeddings of "Searching…"-like markers cluster across variants, cos
  0.977) but only partially at the state level (val operation accuracy
  0.670).
- It did NOT beat kimi's headline on the canonical static eval. On static
  states there is nothing to condition on; the game is picking the right
  constant per page type, and kimi's constants were already near-optimal
  except for target choice.

## Is a small trained model on synthetic-distribution traces enough to gate?

Not on this evidence, for two compounding reasons. (1) The canonical
harness's states carry no step-varying signal, so agreement there cannot
reward step-level conditioning at all — it measures per-page-type constant
policy choice, which a lookup table of three entries "solves" to within the
ceiling. (2) Where the traces DO vary (variant val states), the frozen
encoder + bilinear scorer tops out around 0.67 operation accuracy; end-to-end
fine-tuning showed no quick win at this data scale on CPU. As a veto gate
today, Tier A's honest strengths are latency (20 ms), calibrated abstention,
and target-level proposals on familiar page structures; its weakness is
name-generalization to unseen sites.

## What live-trace retraining needs

1. Labelled traces from REAL runs (shadow.decision events + recorded LLM
   decisions) where state_text varies per step — fill values visible, DOM
   mutations, real status text. The phase-conditioning that synthetic
   variants can only simulate would then be learned from the true
   distribution.
2. Enough volume to justify `--tune-encoder` (end-to-end fine-tuning): at
   hundreds of unique states the frozen regime wins on cost and
   overfitting-resistance; at tens of thousands of live states the encoder
   should be tuned (the machinery ships, measured ~15 min/epoch on CPU).
3. A held-out protocol that keeps whole SITES unseen (name pools were the
   weakest generalization axis here), and abstention thresholds set from
   val calibration rather than argmax-only reporting.

## Reproduce

```bash
cd domains/computer-use/core
uv sync --frozen --extra dev
uv pip install -e '.[tier-a]'
python scripts/tier_a_make_traces.py                      # 579 traces (committed copy exists)
python scripts/tier_a_train.py --epochs 20 --seed 42      # ~45s -> ~/.allternit/shadow-head/tier-a
python scripts/shadow_head_eval.py --head tierA --steps 22
uv run --frozen --no-sync --extra dev pytest tests/test_element_table.py \
    tests/test_decision_head.py tests/test_shadow_hook.py \
    tests/test_shadow_eval_smoke.py tests/test_tier_a_head.py -q
```

Tests: 97 passed, 1 skipped (mlx weights) in the targeted suite; full suite
418 passed / 24 skipped with only the 7 pre-existing failures documented in
the Phase 1 notes (verified byte-identical on pristine HEAD).
