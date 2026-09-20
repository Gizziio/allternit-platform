# Checkpoint — session/laya-finetune (JEV shadow policy-head program, Kaggle run v1 → CPU pivot)

**Goal:** Execute the Kaggle fine-tune run: data + private dataset (done,
`allternit/jev-shadow-train-v1`), adapted notebook, kernel to completion,
result.json reported.

**Just did:** GPU path probe-verified quota-blocked (kernels with
enable_gpu come up CPU-only; account-level, likely the concurrent
`laya-osone-finetune` run). Pivoted to explicit CPU (enable_gpu:false).
Failure chain, all infra, each fixed once: v3-cpu (transient worker DNS in
pip → 5-attempt install loop), v4-cpu (dataset mounts at
/kaggle/input/datasets/<owner>/<slug>/ now → glob discovery), v5-cpu passed
all failure points and trained. Polled 240 × 60 s (~4 h) — still RUNNING,
zero errors; left running server-side (CPU cap ~9 h). Docs updated with the
full saga + resume commands.

**Next (resume):** `kaggle kernels status allternit/jev-laya-finetune-v5-cpu`;
on COMPLETE `kaggle kernels output … -p /tmp/jev-kernel-output` → report
result.json + keep `laya-finetuned/` on disk for local eval. On session-cap
CANCELLED: re-push `/tmp/jev-kernel-v5-cpu` with EPOCHS=1, or use the v2 GPU
bundle once quota returns.

**Open questions:** none blocking — only wall-clock. Commits through
db7f64260; push pending (see git status).
