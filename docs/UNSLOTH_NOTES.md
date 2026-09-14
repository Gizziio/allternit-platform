# Model Lab — Unsloth P1 Integration Notes

## Overview

Model Lab is a local model training backend for Allternit. It exposes an async
HTTP API (Python/FastAPI) that wraps the Apache 2.0 Unsloth core library for
LoRA, QLoRA, full fine-tune, and DPO training. The Allternit Rust API proxies
authenticated requests to this service, and the platform UI surfaces a tabbed
workflow for base-model selection, dataset upload, hyperparameter configuration,
job monitoring, and GGUF/MLX export.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  surfaces/ai.allternit.com/src/views/settings/ModelTrainingView.tsx │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ /api/v1/model-training/*
┌──────────────────────────────▼──────────────────────────────────────┐
│  cmd/allternit-api/src/model_training_routes.rs                      │
│  Proxies to ALLTERNIT_MODEL_TRAINING_URL (default 127.0.0.1:9020)    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────────────┐
│  services/model-training/main.py (FastAPI)                          │
│  services/model-training/worker.py (subprocess training worker)     │
│  services/model-training/trainers/{lora,qlora,full_finetune,dpo}.py │
│  services/model-training/exporters/{gguf,mlx}.py                    │
└─────────────────────────────────────────────────────────────────────┘
```

Artifacts are stored under `~/.allternit/model-training/`:

- `jobs/` — JSON job records
- `datasets/` — uploaded JSONL/CSV files and metadata
- `artifacts/<job_id>/` — adapters, checkpoints, progress, exports

## License Boundary

**Critical:** Unsloth ships multiple products with different licenses.

- `unsloth` (core library) — **Apache 2.0**. This integration uses only the
  core package (`FastLanguageModel`, `SFTTrainer`, `DPOTrainer`, GGUF export).
- Unsloth Studio / `unsloth-studio` UI — **AGPL-3.0**. We do **NOT** install,
  import, or copy any AGPL UI code into Allternit. The Allternit UI is built
  from scratch in `ModelTrainingView.tsx`.

`requirements.txt` intentionally omits `unsloth-studio` and `unsloth-zoo` to
keep the dependency graph on the Apache 2.0 core.

## API Surface

Rust routes (authenticated, mounted at `/api/v1/model-training` and
`/api/model-training`):

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Probe Model Lab service |
| GET | `/base-models` | Curated Unsloth-supported base models |
| POST | `/datasets` | Upload JSONL/CSV dataset |
| GET | `/jobs` | List training jobs |
| POST | `/jobs` | Create a training job |
| GET | `/jobs/:id` | Get job status/loss/checkpoints |
| POST | `/jobs/:id/cancel` | Cancel a running job |
| GET | `/jobs/:id/checkpoints` | List checkpoints |
| POST | `/jobs/:id/export` | Export to GGUF or MLX |
| GET | `/exports/:export_id` | Get export status |

## Running the Python Service

```bash
cd services/model-training
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

The service listens on `127.0.0.1:9020` by default. Override with:

```bash
export ALLTERNIT_MODEL_TRAINING_PORT=9020
```

## Test Path

Run these from the worktree root:

```bash
# Python syntax check
cd services/model-training
.venv/bin/python -m py_compile main.py config.py schemas.py store.py worker.py trainers/*.py exporters/*.py tests/test_import.py

# Import smoke test (does not require unsloth/torch)
PYTHONPATH=services/model-training .venv/bin/python tests/test_import.py

# Rust API compile check
cd /Users/joe/Desktop/allternit-workspace/allternit-session-unsloth-p1
cargo check -p allternit-api
```

TypeScript typecheck is optional because the surface node_modules were not
installed in this session. When dependencies are present, run:

```bash
cd surfaces/ai.allternit.com
pnpm typecheck:fast
```

## Known Limitations / Follow-Up

- Unsloth itself is **not installed** in this worktree; the trainers use lazy
  imports so the service can start and the smoke tests pass.
- The training worker uses multiprocessing; on macOS the `start_method` should
  be `spawn` for fork safety with torch.
- MLX export requires `mlx-lm`, which is listed as a Darwin-only dependency.
- Full fine-tuning assumes sufficient RAM/VRAM; UI does not yet guard against
  model-size vs. memory mismatches.
- No persistent queue backend yet; jobs run one-per-process on the local
  machine.
