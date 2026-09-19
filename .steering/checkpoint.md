# Checkpoint — session/laya-finetune (JEV shadow policy-head program, Kaggle run v1)

**Goal:** Execute the Kaggle fine-tune run: generate TRAIN-split shadow-head
data (8 seeds), push private dataset, adapt the prep notebook to read
/kaggle/input, push a GPU kernel, poll to completion, report result.json.
Owner approval on file (free-cloud-GPU). Do NOT merge / do NOT open a PR
(parent task instruction overrides the merge commandment for this lane).

**Just did:** Data generated (8 seeds × 252 cases, 0 drops, redaction spot
check clean on 2 seeded secrets + 1 name). Dataset `allternit/jev-shadow-train-v1`
private, status ready (train 1,764 / val 252). Upstream laya recipe verified
from raw GitHub files (research branch) — prep summary accurate; found that
`temperature_by_options` in the base config overrides fitted scalar
temperatures at inference, so v1 drops the map at save. Notebook adapted
(builder regenerates it; 17 cells): dataset input, single-GPU torchrun
(nproc_per_node=1), val eval + ECE, result.json, calibration.json. Kernel
pushed and RUNNING as `allternit/jev-laya-shadow-head-fine-tune-v1` (Kaggle
re-derived the slug from the title; metadata in worktree carries the real
slug). Background poller running (60s interval).

**Next:** Wait for kernel terminal state; on COMPLETE fetch output, inspect
result.json + logs, fill in the docs section; on ERROR do one retry cycle
(-v2 slug); commit + push session/laya-finetune.

**Open questions:** whether single-T4 wall-clock stays well under the
session cap (expected: minutes — upstream 2×T4 trains 6k decisions in 4–6
min; we have ~3.5k sequences on 1 GPU); whether `dataset_sources` in
kernel-metadata attached the input (cell 3 asserts it — the run will tell).
