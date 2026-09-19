# Attestation — session/task-variants (Laya fine-tune training volume)

- **Session:** session/task-variants (orchestrated; implementation delegated to a coder subagent, gate claims re-run by the main agent before landing)
- **Date:** 2026-09-19
- **Branch:** `session/task-variants` → **PR #716, MERGED** (merge `154770765`)
- **Follows:** PR #712 (Laya pipeline). Closes the last blocker before the owner-approved Kaggle fine-tune: training volume.

## What was done

- `core/train_tasks.py` — 12 seeded train-split synthetic task templates (checkout, pagination, modal dialog, combobox booking, checkbox/radio, slider, filter chips, registration form, settings tabs, file upload, accordion/FAQ, toast dismiss); each ≥3 distinct whitelist ops + one adapter-failed target (suspected_noop variety); seeded per template (`random.Random(f"{seed}:{task_id}")`) — deterministic, order-independent.
- CLI `--tasks {heldout,train,all}` + `--task-seed`; default heldout byte-identical (test-pinned); `shadow_eval.py` zero edits.
- Split labeling by construction (train ids outside HELD_OUT_TASK_IDS); few-shot leak invariant untouched.

## Volume evidence (mock head, offline, zero cloud)

- Op mix seed 42 (264 steps): click 42% / fill 33% / selectOption 12% / scrollTo 7% / press 5% / doubleClick 2% — full op-family coverage, no click-skewed policy.
- **252 training cases/seed; 504 (seeds 42+7); 0 menu-mismatch drops; ~0.25 s per suite (~60k cases/min theoretical).** Dial: cases ≈ seeds × 12 × (steps−1).
- Redaction: grep for 6 seeded secrets across all traces + exported cases → 0 hits.

## Verification

- 134 passed / 1 skipped (main-agent re-run; skip = pre-existing laya-weights gate). Held-out smoke unchanged (0.7576).

## Notes

- Training JSONLs are regenerable artifacts (gitignored); commands in `docs/JEV_LAYA_NOTES.md` Training volume section.
- Remaining gate: the Kaggle fine-tune run itself (owner creds or manual upload).
