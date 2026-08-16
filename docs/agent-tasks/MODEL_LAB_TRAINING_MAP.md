# Model Lab / Local Engine / Training Integration Map

## Overview
This document maps external local fine-tuning engines, model recipe consoles, and training studio platforms into Allternit Model Lab as native first-class features.

---

### 1. `unslothai/unsloth`
- **Summary:** Ultra-fast, memory-efficient LLM fine-tuning library and recipe ecosystem. Features 2-5x faster training speeds and 70-80% lower VRAM utilization compared to naive PyTorch/FlashAttention2 setups via custom Triton kernels and manual gradient backpropagation.
- **License & Reuse Risk:** Apache 2.0. Low risk.
- **Decision:** **Adopt & Native Integration**. Native integration of Unsloth recipe discovery, fine-tuning notebooks, merged LoRA GGUF exports, and GRPO reasoning training recipes directly into `GuidesPanel.tsx` and `TrainPanel.tsx`.
- **UI Tabs & Backend Routes:**
  - `Catalog › Discover`: Curated Unsloth open-weights recipe feed with direct ACI browser launching.
  - `Train`: Local Unsloth LoRA/QLoRA training job runner and GPU telemetry.
  - Backend: `POST /api/model-lab/jobs` and `GET /api/model-lab/jobs/:id/logs`.

---

### 2. `sybil-solutions/local-studio`
- **Summary:** Local LLM runtime manager and model studio providing recipe-driven execution across llama.cpp, vLLM, SGLang, and MLX backends with unified GPU/VRAM telemetry and request logging.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Native UI Pattern Extraction**. Extracted recipe configurations, controller connection parameters, hardware telemetry widgets, and runtime logs into `LocalStudioPanel.tsx` as the dedicated `Studio` top-level tab.
- **UI Tabs & Backend Routes:**
  - `Studio`: Model Recipe Builder, Active Runtime Status, Usage Metrics, Controller Logs.
  - Backend: `/api/local-studio/*` proxy routes in `cmd/allternit-api/src/local_studio_routes.rs`.

---

### 3. `arman-bd/guppylm`
- **Summary:** WebGPU and browser-based small language model training framework enabling lightweight in-browser parameter updates and fine-tuning experiments.
- **License & Reuse Risk:** MIT. Low risk.
- **Decision:** **Reference for Playground**. Reference its WebGPU shader compilation techniques for client-side evaluation runs in `PlaygroundPanel.tsx`.
- **UI Tabs & Backend Routes:**
  - `Playground`: Interactive client-side model evaluation and prompt testing.

---

### 4. Alibaba Cloud ModelStudio Console
- **Summary:** Enterprise cloud console for model lifecycle management: dataset curation, supervised fine-tuning (SFT), reward modeling (RLHF/DPO), evaluation benchmarks, and single-click endpoint deployment.
- **License & Reuse Risk:** Proprietary UI reference / Cleanroom reimplementation.
- **Decision:** **Adopt Layout & Navigation Hierarchy**. Standardized Model Lab into 6 clean tabs (`Engine`, `Catalog`, `Train`, `Studio`, `Cloud`, `Playground`) with clear job lifecycle indicators and artifact export pipelines.
- **UI Tabs & Backend Routes:**
  - `Engine`: Comprehensive local cache, operations (Quantize/Merge/Eval), and Brain registration.
  - `Train`: Multi-stage training pipeline (Dataset → Training → Evaluation → Deployment).
