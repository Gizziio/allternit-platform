# Checkpoint — session/laya-prep (Laya lane of JEV shadow policy-head program)

**Goal:** Prep the Laya lane: LayaHead behind DecisionHead, >16-option
coarse-to-fine design, trace→fine-tune export, Kaggle prep-only notebook,
zero-shot measurement on the identical 66 steps.

**Just did:** All deliverables committed (13784738b, pushed): core/laya_head.py,
tests/test_laya_head.py (22 tests green), scripts/export_laya_finetune.py,
scripts/run_head_eval.py, notebooks/laya_finetune_kaggle.ipynb (17 cells),
docs/JEV_LAYA_NOTES.md, zero-shot reports (joint 0.227, op-only ≈0.65,
steady-state p50 ~484 ms MPS). Both trace JSONLs export cleanly (63/63 each).
Two-step path verified live against real weights. No training on this machine.

**Next (owner decision):** human gate — approve/merge via PR if wanted (AGENTS.md
merge commandment vs task's explicit "do NOT merge, do NOT open a PR"; task
instruction wins for this lane). Kaggle run is manual: upload notebook +
train-split trace export as Input.

**Open questions:** gate questions exported without labels (v1 gap); target
row indices resolved post-action by the recorder — some drops expected on
real dynamic pages (0 on synthetic).
