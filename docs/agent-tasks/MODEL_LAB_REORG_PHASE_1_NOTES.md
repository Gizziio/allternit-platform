---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/model-lab/ModelLabView.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/LocalRuntimePanel.tsx
  - surfaces/ai.allternit.com/src/views/model-lab/index.ts
deviations: []
remaining: []
---

# Model Lab Reorganization — Phase 1 Notes

## Summary
Reorganized Model Lab top-level navigation into 6 focused tabs: `Engine`, `Catalog`, `Train`, `Studio`, `Cloud`, and `Playground`. Promoted `LocalStudioPanel` to a first-class tab and unified telemetry, local cache, runtimes, operations (quantize/merge/evaluate), sidecar models, deploy-from-job, and brain registration into the landing `Engine` panel.

## Key Changes
1. **ModelLabView.tsx**:
   - Consolidated navigation tabs into 6 clean top-level tabs with icons and `Pill` selectors:
     - `Engine` (`LocalRuntimePanel`)
     - `Catalog` (`ExplorePanel`)
     - `Train` (`TrainingPanel`)
     - `Studio` (`LocalStudioPanel`)
     - `Cloud` (`CloudPanel`)
     - `Playground` (`PlaygroundPanel`)
2. **LocalRuntimePanel.tsx**:
   - Comprehensive unified engine workspace featuring:
     - Telemetry & hardware resource monitoring (Health, CPU, RAM, GPU, Apple Silicon Unified Memory, Disk).
     - Local model cache with multi-backend execution (`vLLM`, `SGLang`, `llama.cpp`, `MLX`).
     - In-place model operations: Quantize (QLoRA formats), Merge LoRA adapters, and Benchmark Evaluation (MMLU, ARC, HellaSwag, etc.).
     - Sidecar model management with HF search, download, and delete.
     - Deploy-from-completed-training-job workflow.
     - Direct Brain registration for local engine and sidecar models.
3. **Clean Module Exports**:
   - All components properly exported in `index.ts` with no dangling or unused sub-panels.
