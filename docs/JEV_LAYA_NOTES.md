# JEV Shadow Policy Head — Laya Lane Notes

**Date:** 2026-09-19 · **Branch:** `session/laya-prep` (based on `origin/main` 809776dea) · **Status:** prep complete — zero-shot measured, fine-tune pipeline built and dry-run, no training on this machine (inference only, per policy).

## What Laya actually is (package reality-check)

READMEs in this space overstate; the installed package (`laya==0.3.3`, PyPI) and the HF hub repo (`convaiinnovations/laya`) were read directly. Verified facts:

| Claim to verify | Reality (source: site-packages `laya/agent.py`, `laya/common.py`; HF API file listing; GH `NandhaKishorM/laya`) |
|---|---|
| `laya.load` signature | `laya.load(model_id_or_path="convaiinnovations/laya", device=None, token=None, subfolder=None)` → `Agent`. Local directories load verbatim (path exists → skip download), so a fine-tuned checkpoint drops in via `LayaHead(model=<dir>)`. |
| Subfolder / `allow_patterns` | Supported: `subfolder="multilingual"` downloads only `multilingual/*`. **The english checkpoint is at the repo ROOT** (not a subfolder); sibling subfolders are `multilingual` and `typed-decisions` (verified via the hub `/api/models` siblings list). |
| Predict entry point | `Agent.system_one(state, questions)` (alias `predict`). ONE batched, non-autoregressive forward pass over ALL questions in the dict. `state` may be str/dict/list; we pass the shadow `state_text` string. |
| Question schema | `{qid: {"type": "choice"\|"score"\|"noul", "instructions": str, "criteria": dict (choice) \| list (score)}}`. `choice` criteria keys are the option strings. |
| Return shape | `{"model": "laya-rl-agent", "answers": {qid: {"type", "choice"\|"noul"\|"score", "probabilities", "confidence", "action": {"act_probability"}}}, "usage": {...}}`. |
| Confidence | **Present, per answer** — normalized Shannon entropy (`confidence_from_probs`, identical convention to our `entropy_confidence`). `noul` confidence is `max(p, 1-p)`. |
| Probabilities | **Rounded to 4 decimals** — a full menu can drift off sum=1.0 (up to ~8e-4 at 16 options, ~3.2e-3 at 64), which fails our `Choice` validator's 1e-3 tolerance. `LayaHead` renormalizes before constructing Choices. |
| Head budget | `head_max_len=192` in the base checkpoints: every option shares it (~48 option tokens each before forced truncation); `build_sequence` raises when options overflow. This is the mechanical root of their >20-option degradation (Banking77 0.425). |
| `score` type | Ordinal rubric; unused by our question set (only `choice` + boolean gates). |
| Fine-tune API | No trainer ships in the package, but `laya.common` has the full substrate (`build_sequence`, `proper_reward`, `build_model`, `QTYPES`) and the GitHub repo's official Kaggle notebook (`notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb`) is the canonical recipe: preprocess to tokenized items → `torchrun --nproc_per_node=2` DDP script (pure policy gradient + proper scoring rule + GRPO baseline + soft-CE guidance) → post-hoc per-qtype temperature calibration (LBFGS). The training row schema is `LocalLLaMA/typed-decisions`: `{id, workflow, state, questions, gold}` as **JSON strings**, gold per question = `{label, probabilities}` over the criteria keys. |
| Device behavior | Auto: CUDA > MPS > CPU. fp16 on CUDA, **fp32 on MPS/CPU**. ModernBERT `reference_compile` is force-disabled (eager). |

## Setup (this machine)

```bash
cd domains/computer-use/core
uv venv && uv pip install -e . pytest pytest-asyncio "laya>=0.3.3"
# first load downloads the english checkpoint (~808MB, public/ungated) to the
# HF cache; inference afterwards is fully local (MPS here, works on CPU too)
```

Optional dependency, same contract as the mlx/SemIf heads: importing `core.laya_head` never needs `laya`; constructing `LayaHead` without it raises `ShadowHeadDependencyError` with the install line. No API keys anywhere.

## The >16-option design (in from the start)

Laya's own honesty section: `choice` degrades past ~20 options because options share the 192-token head budget; their recommendation is two-step coarse-to-fine. Our `<op>_target` menus run to 64 row indices, so `LayaHead` implements it as the default path, not a fallback:

- Menus ≤ `max_direct_options` (16) → one `choice` question, criteria keys = exact option strings.
- Menus > 16 → **two sequential batched passes**: pass 1 asks one `choice` over consecutive row-index range groups (`0-15`, `16-31`, …, ≤16 groups); pass 2 asks one `choice` over the winning group's options only.
- Probability combination is multiplicative: `p(option) = p(group) * p(option|group)`; losing groups spread their coarse mass uniformly within the group (the coarse pass carries no within-group detail). Renormalized after combination.
- Confidence comes from the in-group (fine) answer — it reflects the decisive distribution.
- **Latency cost**: exactly one extra batched forward pass per `decide()` containing any oversized menu. Every pass re-encodes the state per question, so the coarse pass costs the same as any other question. Measured warm on this machine (MPS): ~312–320 ms for a 40-option two-step decide vs ~313 ms for a small-menu direct decide — the second pass is effectively free at our batch sizes; the eval-shaped passes (10–13 questions) run 380–490 ms/step.

## Zero-shot measurement (identical 66 steps: 3 tasks × 22, deltas on, grafts off)

Via `scripts/run_head_eval.py` (standalone single-head runner — the shared CLI is owned by another lane and untouched):

```
python scripts/run_head_eval.py --module core.laya_head --class LayaHead \
    --steps 22 --stem shadow-eval-report-laya \
    --trace-out evaluation/tier-a/live-traces-laya.jsonl
```

| Metric | Value |
|---|---|
| Joint agreement (op + target) | **0.2273** |
| Operation-only agreement (per task) | search-flow 0.6364 · form-fill 0.3182 · settings-toggle 1.0000 (≈0.65 overall) |
| Target agreement (where op matched) | 0.5 / 0.0 / 0.36 |
| stuck=true rate (success / failure) | 0.0 / 0.0 |
| goal-satisfied=true rate | 0.2424 |
| Mean head latency | 1548 ms aggregate — **inflated by the one-time first-forward MPS warmup in step 1** (65 s); steady state p50 ≈ 484 ms, mean ≈ 565 ms |
| Mean scripted-LLM latency | 850 ms (reference) |

Reading: near-random on joint agreement is the expected zero-shot result — the base checkpoint has never seen our state format or element-row vocabulary, and their own honesty number for out-of-distribution typed-decisions is ≈0.35. Operation agreement at ~0.65 shows the model does extract signal even zero-shot. This confirms their honesty claim; it is not a failure of the integration. The numbers that matter for prep all landed:

1. **It runs end-to-end behind the DecisionHead protocol** — 66/66 decide steps, full validation, no head failures, traces recorded.
2. **Real local latency is measured** (see table; also: first-ever forward in a process pays ~38–56 s of MPS kernel compilation — warmup, not inference).
3. **The two-step path works live** — the synthetic eval's element tables are small (target menus ≤ 6 options; 0 oversized menus in 66 steps), so it is NOT exercised by the eval itself; verified separately against the real weights with a 40-option menu: group pick → in-group pick → combined distribution sums to 1.0, validates, warm latency ~312 ms. Unit tests (`tests/test_laya_head.py`, stubbed scorer) cover it deterministically.

Reports: `domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-laya.{json,md}` (+ `-laya-mock.{json,md}` for the mock-head plumbing run through the same runner).

## Fine-tune plan (Kaggle, free 2×T4 — prep only, no creds on this machine)

Pipeline pieces, all built and dry-run offline:

1. **Traces** — any harness run with `shadow_trace_path` set appends labeled JSONL (`core/trace_recorder.py`). Labels come from the **recorded-LLM transcript** (`gold` field), never from the head — so mock-head runs produce perfect labels at zero cost.
2. **Export** — `scripts/export_laya_finetune.py` converts trace JSONL → typed-decisions-style cases. Two things it does beyond a naive conversion, both documented in its docstring:
   - **Temporal realignment (default on):** the recorder labels each record with the *previously executed* step (the action whose effect is visible in the state). A policy deciding *from* state S must predict the action taken *from* S — which is the next record's gold. The exporter shifts golds one step forward within each run (drops each run's tail record; `--no-realign` for the naive mapping). Verified: step-1 case golds match the transcript's step-2 action, never the head's own choice.
   - **Menu validation:** aligned labels whose operation/target row index is not in that state's own question menus are dropped with a counted reason (row indices shift when the page changed between steps). Mock-run result: 63/63 converted, 0 dropped. Laya-run result: 63/63, 0 dropped.
   - Gates (`goal_satisfied`/`stuck`) carry no gold in the recorder schema → exported as questions without gold entries (skipped by training) — known v1 gap; derivable later from `llm.success`/run completion.
3. **Notebook** — `domains/computer-use/core/notebooks/laya_finetune_kaggle.ipynb` (17 cells; built by `notebooks/build_laya_notebook.py`): GPU check → install → Input upload → preprocess (`max_len=1024`, `head_max_len=256` — same bump the upstream typed-decisions run uses; gives 16 target options ~48 tokens each) → the upstream DDP train script (proper-scoring-rule RLCD + GRPO baseline + soft-CE + per-qtype temperature calibration, unchanged) → held-out eval via plain `laya.Agent` → zip/download. Budget: upstream trains 6,000 decisions in ~4–6 min on 2×T4; JEV traces are orders of magnitude smaller (a 66-step run exports ~120 labeled decisions), so the free-session cap is never the constraint at current trace volumes.
4. **Consume** — point `LayaHead(model=<downloaded dir>)` at the checkpoint; `laya.Agent` loads the saved layout natively (verified in source). `temperature=` override exists in the head if the fitted calibration ever needs a manual scalar.

Sample converted training row (mock-head run, `--report` prints it; 63 cases at `evaluation/tier-a/laya-cases-mock.jsonl`, laya run at `laya-cases-laya.jsonl`):

```json
{"id": "search-flow:cu-82d4ed8a55c1:1", "workflow": "search-flow", "split": "heldout",
 "state": "\"[TASK]\\nSearch for 'quarterly report' …\"",
 "questions": "{\"operation\": {\"type\": \"choice\", \"instructions\": \"…\", \"criteria\": {\"click\": \"…\", …}}, …}",
 "gold": "{\"operation\": {\"label\": \"fill\", \"probabilities\": {\"click\": 0.0, …, \"fill\": 1.0, …}}}"}
```

Note: eval-task traces are all labeled `split=heldout` by the recorder — they verify the pipeline but must never become training rows (the kimi_fewshot leak invariant generalizes). Real training data = live-harness traces from non-held-out tasks.

## Honest verdict

- Laya is the best-fitting local candidate so far on *interface* alone: typed questions with native per-option distributions + calibrated confidence map 1:1 onto our `Choice` contract (vs SemIf's A–P 16-cap letters, vs our mlx head's first-token trick). The 33 ms-class latency claim is real on CUDA T4-class hardware but not on this machine — MPS steady state is ~0.4–0.5 s per decide-step pass; fine for shadow mode, wrong for any latency-bound loop.
- Zero-shot is near-random on joint agreement, as predicted by their honesty section — the value is in the fine-tune, and the whole point of the lane is that the fine-tune pipeline is now real: export → Kaggle → checkpoint → `LayaHead(model=...)`.
- Known gaps, in honesty order: (1) gate questions are exported without labels; (2) target row indices are resolved by the recorder against the *post-action* table, so a subset of aligned target labels can point at the wrong row when the page restructured mid-step (currently dropped on menu mismatch — 0 drops observed on static synthetic trees; expect some on real pages); (3) the two-step path is unit-tested and live-smoked but not yet stressed on real 64-option menus; (4) the reference itself caps reproducible agreement (~0.60 op / ~0.5 joint, per JEV_ACCURACY_PUSH_NOTES.md) — fine-tuning teaches the head to imitate the reference, not to be right.

## Files

- `domains/computer-use/core/core/laya_head.py` — the head (protected `core/decision_head.py` untouched)
- `domains/computer-use/core/tests/test_laya_head.py` — 22 tests, stubbed scorer, no weights needed
- `domains/computer-use/core/scripts/export_laya_finetune.py` — trace → typed-decisions exporter
- `domains/computer-use/core/scripts/run_head_eval.py` — standalone single-head eval runner
- `domains/computer-use/core/notebooks/laya_finetune_kaggle.ipynb` (+ `build_laya_notebook.py`)
- `domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-laya{,-mock}.{json,md}`
- `domains/computer-use/core/evaluation/tier-a/live-traces-{mock,laya}.jsonl`, `laya-cases-{mock,laya}.jsonl`
