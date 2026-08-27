---
title: "GuppyLM Audit — Phase 1 Notes"
status: complete
phase: 1
created: 2026-08-13
task_spec: docs/agent-tasks/GUPPYLM_AUDIT_PHASE_1_TASK.md
source_repo: https://github.com/arman-bd/guppylm
source_license: "MIT (per README; no LICENSE file committed — verify before shipping code)"
allternit_integration_tracker_item: "P3 §3.6 — GuppyLM: Educational micro-model training; not production"
constraints_met:
  - no code changes
  - no git commits
---

# GuppyLM Audit — Phase 1 Notes

## 1. Executive Summary

GuppyLM is a **~8.7 M parameter vanilla transformer** trained from scratch in ~5 minutes on a T4 GPU. The project ships a complete pipeline: synthetic data generation → BPE tokenizer training → PyTorch training → ONNX export → **in-browser inference via ONNX Runtime Web (WASM)**. It is intentionally simple — no GQA, no SwiGLU, no RoPE — making it an ideal educational scaffold for demonstrating the full model lifecycle.

Allternit already has a **cloud-based Unsloth Model Lab** (LoRA/QLoRA training on Llama/Qwen/Gemma models, `services/model-lab/` + `model_lab_routes.rs` + Catalog/Train/Jobs/Cloud tabs) but **zero browser-side training or inference capability**. GuppyLM's ONNX→WASM pipeline is the simplest path to a "Browser Training" tab that complements the existing cloud stack.

**Recommendation:** Integrate as a lightweight "Browser Training" micro-app inside Model Lab (or as a standalone A://Labs demo), using GuppyLM's architecture as the reference implementation.

---

## 2. GuppyLM Technical Deep-Dive

### 2.1 Model Architecture

| Parameter | Value | Notes |
|-----------|-------|-------|
| Parameters | 8.7M | ~35 MB float32, ~9 MB uint8 quantized |
| Type | Decoder-only Transformer | Vanilla — no modern optimizations |
| Layers | 6 | |
| Hidden dim | 384 | |
| Attention heads | 6 | Head dim = 64 |
| FFN hidden | 768 | 2× hidden dim |
| Vocab | 4,096 | BPE (byte-level) |
| Max seq length | 128 tokens | Single-turn only |
| Positional encoding | Learned embeddings | Not RoPE |
| Activation | ReLU | Not GELU/SwiGLU |
| Normalization | Pre-LayerNorm | |
| LM head | Weight-tied with embeddings | |
| Dropout | 0.1 | |

**What's excluded:** No GQA, no RoPE, no SwiGLU, no parallel residuals, no early exit, no KV-cache. This is deliberate — it's the simplest possible transformer that still produces coherent text on a narrow domain.

### 2.2 Training Pipeline

**Training environment:** PyTorch on Google Colab T4 GPU (or local CUDA/MPS/CPU).

```
generate_data.py → prepare_data.py → train.py → export_onnx.py
   (60K samples)    (BPE tokenizer)    (10K steps)   (quantized ONNX)
```

#### Data Generation (`generate_data.py`)
- **60,000 synthetic samples** across 59 categories.
- Template-composition system: randomized components (30 tank objects, 17 food types, 25 activities) combined via `join_sentences(pick(starters), pick(middles), pick(extras))`.
- Personality baked into weights: lowercase, short sentences, aquatic worldview, no human abstractions.
- Format: ChatML (`<|im_start|>user/assistant`).
- Output: `data/train.jsonl` (57K) + `data/eval.jsonl` (3K).

#### Tokenizer (`prepare_data.py`)
- HuggingFace `tokenizers` library, ByteLevel BPE.
- Vocab size: 4,096, special tokens: `<pad>` (0), `<|im_start|>` (1), `<|im_end|>` (2).
- Trained on the generated corpus.

#### Training (`train.py`)
- **Optimizer:** AdamW, betas (0.9, 0.95), weight_decay 0.1.
- **LR schedule:** Linear warmup (200 steps) → cosine decay to `min_lr=3e-5`.
- **AMP:** `torch.amp.autocast("cuda")` + `GradScaler` (CUDA only).
- **Gradient clipping:** 1.0 norm.
- **Steps:** 10,000 max, eval every 200 steps, checkpoint every 500.
- **Batch size:** 32.
- **Loss:** Cross-entropy with `ignore_index=0` (pad token).
- **Checkpoints:** `best_model.pt`, `step_{N}.pt`, `final_model.pt`.
- **Training time:** ~5 minutes on T4.

#### Dataset Loading (`dataset.py`)
- `GuppyDataset` reads JSONL, tokenizes, truncates to `max_len=512`.
- Collate function pads to batch max length.
- Standard PyTorch `DataLoader` with `pin_memory=True`.

### 2.3 ONNX Export (`export_onnx.py`)

- `torch.onnx.export` with dynamic axes for batch and seq_len.
- Opset version 17.
- Input: `input_ids` (int64), Output: `logits` (float32).
- **Quantization:** `onnxruntime.quantization.quantize_dynamic` with `QuInt8` → 35 MB → 9 MB.
- Tokenizer JSON copied alongside model for web deployment.
- Optional: `--push` uploads to HuggingFace Hub.

### 2.4 Browser Inference (`docs/index.html`)

**Stack:** Pure HTML/CSS/JS + ONNX Runtime Web v1.21.0 (WASM execution provider).

**How it works:**
1. Dynamically imports `onnxruntime-web` from jsDelivr CDN.
2. Downloads `tokenizer.json` + `model.onnx` (~10 MB) via `fetch`.
3. Creates `ort.InferenceSession` with `executionProviders: ["wasm"]`.
4. Custom JS BPE tokenizer (port of HuggingFace byte-level BPE).
5. Autoregressive generation loop:
   - Truncates to `max_seq_len=128`.
   - Creates `BigInt64Array` tensor, runs `session.run({input_ids})`.
   - Extracts last-position logits, applies temperature (0.7) + top-k (50) filtering.
   - Manual softmax + weighted random sampling.
   - Stops on EOS token (2) or `max_tokens=32`.
6. Chat UI with light/dark theme, sample prompts, topic overlay.

**Key insight:** No WebGPU used — it's pure WASM, running on CPU. This means it works on every browser without GPU requirements, but generation is slow (acceptable for a 9M param model).

### 2.5 Dependencies

```
torch>=2.0.0
tokenizers>=0.19.0
tqdm>=4.65.0
numpy>=1.24.0
datasets>=2.14.0
```

Plus: `onnxruntime` (for export), `onnxruntime-web` (CDN for browser).

---

## 3. Comparison with Allternit's Existing Infrastructure

### 3.1 Current State: What Exists on This Branch

**No training code exists in this worktree.** The Unsloth Model Lab (`services/model-lab/`, `model_lab_routes.rs`) and Model Studio cloud training live on unmerged branches (`ao/p1-unsloth`, `ao/p1-model-studio`). The roadmap explicitly states: *"No training/fine-tuning/LoRA backend. No MLX/Unsloth/PEFT integration."*

**However, a mature WebGPU inference framework already exists:**

| Component | Status | Location |
|-----------|--------|----------|
| **Model catalog & type system** | ✅ Implemented | `surfaces/ai.allternit.com/src/lib/local-models/types.ts`, `catalog.ts` |
| **Provider registry & routing** | ✅ Implemented | `provider-registry.ts`, `router.ts`, `loopback.ts` |
| **Ollama provider** | ✅ Full | `providers/ollama.ts` — health check, pull, streaming chat, tool calls |
| **Browser WebGPU provider** | ✅ Framework | `providers/browser-webgpu.ts` — trusted-adapter registry, `navigator.gpu` detection |
| **Bonsai WebGPU runtime** | ✅ 44 files | `bonsai-runtime/` — custom WGSL shaders, flow-matching diffusion, VAE decode |
| **Bonsai owned pipeline** | ✅ Experimental | `bonsai-owned-webgpu.ts` — auditable, Allternit-owned WGGPU pipeline |
| **Local model management UI** | ✅ Inference only | `LocalModelManager.tsx`, `ModelManagementView.tsx` |
| **Transformers.js** | ❌ Placeholder | Listed in `LocalRuntimeEngine` type union, never imported |
| **ONNX Runtime Web** | ❌ Not used | ONNX used only for Piper TTS in `services/voice/` |
| **Training / fine-tuning** | ❌ None | Zero gradient/backprop/LoRA code anywhere |

**Bonsai WebGPU runtime details (key discovery):**
- 8 custom WGSL shader modules: `dense-linear`, `online-attention`, `packed-affine-matmul`, `qwen-kernels`, `tensor-layout`, `transformer-primitives`, `vae-kernels`, `vae-tiled-kernels`.
- Full pipeline: text encoding → flow-matching diffusion → VAE decoding, all on GPU.
- GPU buffer arenas, safetensors range loading, RoPE, Qwen BPE tokenizer.
- `BrowserWebGpuProvider` has a **trusted-adapter registry** (`BrowserModelRuntime` interface) — new runtimes can be registered without modifying the provider.

**This is inference only.** No backpropagation, gradient computation, or weight-updating code exists anywhere in the WebGPU runtime.

### 3.2 Side-by-Side: Model Lab (Unsloth) vs GuppyLM

| Capability | Model Lab (Unsloth, unmerged) | GuppyLM |
|-----------|-------------------------------|---------|
| **Training location** | Cloud GPU or local GPU | Local GPU (Colab T4) |
| **Training method** | LoRA / QLoRA fine-tuning | Full pre-training from scratch |
| **Target models** | Llama, Qwen, Gemma (1B–24B) | Custom 9M param transformer |
| **Framework** | Unsloth Core (Python/PyTorch) | Vanilla PyTorch |
| **Inference** | Local (GGUF/MLX) or cloud API | Browser (ONNX WASM) |
| **Dataset** | User-uploaded | Synthetic template generation |
| **Export** | GGUF, FP8, NVFP4, MLX | ONNX (uint8 quantized) |
| **UI** | Catalog / Train / Jobs / Cloud tabs | Single HTML chat page |
| **Backend** | Python worker + Rust proxy routes | None (standalone) |
| **Browser inference** | ❌ None | ✅ ONNX Runtime Web |
| **Browser training** | ❌ None | ❌ None (training is server-side) |

### 3.3 Key Gaps GuppyLM Fills

1. **Browser-side LLM inference:** Allternit's browser inference is limited to image generation (Bonsai WebGPU) and Ollama proxy. GuppyLM adds **client-side text generation** via ONNX WASM — a different execution path that complements the existing WebGPU stack.
2. **Full lifecycle demo:** Train → export → deploy → chat, all visible and understandable in one codebase.
3. **Educational value:** Users can see every component (tokenizer, weights, attention, generation) — impossible with 7B+ parameter models.
4. **Synthetic data generation:** The template-composition system is a clean pattern for custom-domain data creation.
5. **Integration hook:** The existing `BrowserWebGpuProvider` trusted-adapter registry could register a GuppyLM ONNX runtime alongside the Bonsai image runtimes — the framework is already built for this.

### 3.4 Key Gaps GuppyLM Does NOT Fill

1. **No browser training:** Training is still Python/PyTorch server-side. No in-browser fine-tuning.
2. **No WebGPU acceleration:** GuppyLM's inference is CPU-only (WASM). Allternit's existing WebGPU runtime could theoretically accelerate it, but the Bonsai shaders are purpose-built for diffusion, not autoregressive text generation.
3. **No production value:** 9M params on a narrow domain; not useful for real tasks.
4. **No multi-turn:** 128-token context window limits to single exchanges.

---

## 4. Phase 2 Proposal: "Browser Training" Micro-App

### 4.1 Concept

A lightweight tab inside Model Lab (or standalone micro-app) that lets users:
1. **Define a personality/domain** (name, topics, style).
2. **Generate synthetic training data** in-browser (JS port of `generate_data.py`).
3. **Train a tiny model** via a cloud worker or local Python subprocess.
4. **Export to ONNX** and load in-browser for instant chat.

This is **not** a replacement for the Unsloth training pipeline — it's a complementary educational/demo experience that showcases the full model lifecycle.

### 4.2 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser Training Tab (React + Zustand)                  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Define   │→ │ Generate │→ │ Train    │→ │ Chat    │ │
│  │ Persona  │  │ Dataset  │  │ (async)  │  │ (ONNX)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│       │              │             │             │      │
│       │              │             ▼             │      │
│       │              │     POST /api/model-lab/  │      │
│       │              │     browser-train/jobs    │      │
│       │              │             │             │      │
│       │              ▼             ▼             ▼      │
│       │        ┌──────────────────────────────────┐     │
│       │        │  Python Worker (guppy-trainer)    │     │
│       │        │  - synthetic data generation      │     │
│       │        │  - tokenizer training             │     │
│       │        │  - model training (PyTorch)       │     │
│       │        │  - ONNX export + quantization     │     │
│       │        └──────────────────────────────────┘     │
│       │                                                 │
│       └─── JS synthetic data generator (client-side) ──┘│
└─────────────────────────────────────────────────────────┘
```

### 4.3 Implementation Plan (Phase 2 Scope)

#### Step 1: Python Training Worker
- Port `guppylm/` Python package as `services/guppy-trainer/`.
- Expose async job API: `POST /api/model-lab/browser-train/jobs`.
- Accept config: persona name, topics list, vocab_size, n_layers, max_steps.
- Output: `model.onnx` (quantized) + `tokenizer.json`.
- Reuse GuppyLM's `config.py`, `model.py`, `train.py`, `generate_data.py`, `export_onnx.py` as-is.

#### Step 2: Rust Proxy Routes
- Add routes in `cmd/allternit-api/src/model_lab_routes.rs` (extend existing).
- `POST /api/model-lab/browser-train/jobs` → proxy to Python worker.
- `GET /api/model-lab/browser-train/jobs/:id` → status + download links.
- `GET /api/model-lab/browser-train/artifacts/:id/model.onnx` → serve ONNX.

#### Step 3: Browser Inference Engine
- Create `surfaces/ai.allternit.com/src/lib/browser-ml/` with:
  - `onnxSession.ts` — ONNX Runtime Web session management.
  - `bpeTokenizer.ts` — JS BPE tokenizer (port from GuppyLM's `index.html`).
  - `generation.ts` — autoregressive generation loop with temperature/top-k.
- Use `onnxruntime-web` npm package (already proven in GuppyLM demo).
- **Register as a `BrowserModelRuntime`** in the existing `BrowserWebGpuProvider` trusted-adapter registry (`providers/browser-webgpu.ts`). This plugs GuppyLM into the same provider framework that already manages Bonsai image generation — the model appears in the catalog, gets routing, and shows up in `LocalModelManager.tsx` alongside Ollama and WebGPU models.
- **WebGPU upgrade path:** ONNX Runtime Web supports `webgpu` execution provider. A future step could port the autoregressive generation loop to WGSL compute shaders, reusing patterns from `bonsai-runtime/` (GPU buffer arenas, packed affine matmul, online attention).

#### Step 4: UI Components
- New `BrowserTrainingView.tsx` with 4-step wizard:
  1. **Persona Builder:** name, description, topic categories, style descriptors.
  2. **Dataset Preview:** show generated samples, edit/remove individual entries.
  3. **Training Dashboard:** progress bar, loss curve, ETA, live logs.
  4. **Chat Playground:** interact with trained model, share/export.
- Zustand store: `useBrowserTrainingStore`.
- API client: `browserTrainingApi.ts`.

#### Step 5: Client-Side Data Generation (Optional Enhancement)
- Port `generate_data.py` → TypeScript for instant in-browser dataset preview.
- User defines topics + templates, JS generates N samples client-side.
- Upload to worker for training, or train a tiny model entirely client-side via `onnxruntime-web` training API (experimental).

### 4.4 Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Browser inference | `onnxruntime-web` (WASM) | Proven, works everywhere, no GPU needed for 9M params |
| Browser inference (future) | `onnxruntime-web` (WebGPU) | GPU acceleration when available; graceful fallback to WASM |
| Provider integration | `BrowserWebGpuProvider` adapter registry | Existing trusted-adapter framework; model appears in catalog automatically |
| Training backend | Python + PyTorch | GuppyLM's existing stack; no rewrite needed |
| Export format | ONNX uint8 quantized | ~9 MB, fast download, proven quality |
| Tokenizer | BPE (byte-level) via `tokenizers` | Industry standard, JS port available |
| Frontend | React + Zustand | Matches existing Allternit surface patterns |
| API | REST via existing `model_lab_routes.rs` | Extends current proxy pattern |
| WebGPU shaders (stretch) | WGSL via `bonsai-runtime/` patterns | Reuse GPU buffer arenas, packed matmul, online attention from existing runtime |

### 4.5 Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| License: no LICENSE file in GuppyLM repo | High | Verify MIT before shipping; contact author; worst case, reimplement (~500 LOC of vanilla transformer) |
| WASM inference slow on mobile | Medium | Cap at 9M params; show progress indicator; WebGPU opt-in for capable devices |
| Training requires GPU backend | Medium | Use existing cloud training infra (Model Studio); queue jobs; show ETA |
| ONNX Runtime Web bundle size (~5 MB WASM) | Low | Lazy-load on tab entry; CDN caching; progressive download |
| User expectations (expects smart model) | Low | Clear UX framing: "train a tiny fish brain" — educational, not production |

### 4.6 Estimated Scope

| Phase | Work | Files |
|-------|------|-------|
| 2a: Python worker | Port GuppyLM package, async job API | `services/guppy-trainer/` (~8 files) |
| 2b: Rust routes | Proxy + artifact serving | `model_lab_routes.rs` (~50 LOC) |
| 2c: Browser ML lib | ONNX session + BPE + generation | `src/lib/browser-ml/` (~3 files) |
| 2d: UI | 4-step wizard + Zustand store | `BrowserTrainingView.tsx` + store (~4 files) |
| **Total** | | **~18 files, ~2,000 LOC** |

### 4.7 Stretch Goals (Phase 3+)

- **In-browser training:** ONNX Runtime Web has experimental training support. A 9M-param model could train entirely client-side on a modern laptop — no backend needed.
- **Custom architectures:** Let users choose model size (3M / 9M / 27M params) and see how quality scales.
- **A://Labs module:** Generate an interactive course from this codebase using the existing `alabs-course-pipeline` skill.
- **Benchmark suite:** Train the same architecture on different datasets and compare quality — teaches data quality > model size.

---

## 5. File Inventory (GuppyLM)

| File | Purpose | Reuse Plan |
|------|---------|------------|
| `guppylm/config.py` | Model + training hyperparameters | Port as TypeScript config schema |
| `guppylm/model.py` | Vanilla transformer (120 LOC) | Reference for Python worker |
| `guppylm/train.py` | Training loop (cosine LR, AMP) | Python worker core |
| `guppylm/generate_data.py` | Synthetic data (60 topics, 60K samples) | Port to TS for client-side preview |
| `guppylm/prepare_data.py` | BPE tokenizer training | Python worker step |
| `guppylm/dataset.py` | DataLoader + collation | Python worker step |
| `tools/export_onnx.py` | ONNX export + quantization | Python worker final step |
| `docs/index.html` | Browser inference + chat UI | Reference for `browser-ml/` lib |

---

## 6. Decision Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Integrate into Model Lab vs standalone | Model Lab tab | Leverages existing routes, store, and UI patterns |
| WASM vs WebGPU inference | WASM first, WebGPU later | WASM works everywhere; WebGPU as progressive enhancement via ONNX Runtime Web's `webgpu` provider |
| Port GuppyLM code vs rewrite | Port as-is | ~500 LOC of clean, tested code; not worth rewriting |
| Training: client vs server | Server (Python worker) | ONNX WebGPU training is experimental; server is proven |
| Target audience | Educational / demo | Not production — clearly frame as "learn how training works" |
| Provider registration | `BrowserWebGpuProvider` adapter | Existing trusted-adapter registry; model appears in catalog + routing automatically |
| WebGPU shader reuse | `bonsai-runtime/` patterns | GPU buffer arenas, packed affine matmul, online attention already proven in production |
