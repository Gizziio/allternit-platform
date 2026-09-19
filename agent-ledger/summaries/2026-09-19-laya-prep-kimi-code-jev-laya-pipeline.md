# Attestation — session/laya-prep (Laya System 1 head + Kaggle fine-tune pipeline)

- **Session:** session/laya-prep (orchestrated; implementation delegated to a coder subagent, gate claims re-run and report numbers re-read by the main agent before landing)
- **Date:** 2026-09-19
- **Branch:** `session/laya-prep` → **PR #712, MERGED** (merge `d1153522a`)
- **Context:** owner directive 2026-09-19 — pursue 90–100% agreement; free-cloud-GPU (Kaggle) fine-tuning on harness traces explicitly APPROVED (no local training; local inference only). Follows PR #709 (accuracy push: structural cap quantified — 90–100% needs a fine-tuned model on our trace distribution).

## What was done

- **`core/laya_head.py`** — `convaiinnovations/laya` (ModernBERT RLCD, Apache 2.0) behind the `DecisionHead` protocol: one batched forward pass per step; gates → noul; ≤16-option menus → choice; **>16 options → deterministic two-step coarse-to-fine** (designed in from the start per the published >20-option degradation; mechanical root located in their code: `head_max_len=192`). Laya returns per-answer calibrated confidence (entropy-based).
- **`scripts/run_head_eval.py`** — standalone programmatic head runner (shared CLI untouched; zero diff verified on the five protected files).
- **`scripts/export_laya_finetune.py`** — trace JSONL → Laya fine-tune schema, gold from the transcript. **Temporal realignment default-on (documented):** recorder gold is the previously-executed step; a policy deciding from state S must predict the action from S — labels shift one step within each run. Verified explicitly (step-1 case carries the transcript's step-2 action, never the head's choice).
- **`notebooks/laya_finetune_kaggle.ipynb`** (17 cells, generator script; upstream RLCD recipe unchanged; free 2×T4 budget stated). Prep-only — no Kaggle creds on this machine.

## Zero-shot measurement (identical 66 steps)

**Joint 0.2273** — the same zero-shot ceiling as mlx/SemIf (confirms Laya's own honesty: base models ≈ near-random). settings-toggle op-type 1.000. Steady-state p50 ≈ 484 ms/step on this machine (their 33 ms is CUDA-T4-class; one-time MPS warmup ~65 s documented). Two-step path verified live against a real 40-option menu.

## Verification

- 107 passed / 1 skipped (main-agent re-run); protected files zero-diff; JSON numbers re-read and matched.

## Honest deferrals

- **Training volume is the blocker, not mechanism**: current eval-task traces are all `split=heldout` by construction (63 cases — pipeline verification only). Next: task-variant expansion (train-split synthetic variants; canonical 3 stay held out) and/or owner-gated live recording.
- The Kaggle run itself awaits owner action (creds or manual upload).
- Gate-gold export: recorder schema has no gate labels (v1 gap, documented).
- `--head laya` in the shared CLI: deferred (standalone runner covers it; rides the fine-tune-results PR).
