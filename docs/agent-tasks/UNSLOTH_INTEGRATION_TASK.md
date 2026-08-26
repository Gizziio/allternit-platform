# P1: Unsloth Training Backend / Model Lab (Phase 1)

## Goal
Research `unslothai/unsloth` and scaffold an Allternit Model Lab backend that supports open-weight model download, fine-tuning, and optimization.

## Reference
- Upstream: https://github.com/unslothai/unsloth
- Allternit model surfaces: `surfaces/ai.allternit.com/src/lib/local-models/`, `src/lib/models/`, and any training-related UI.

## Tasks
1. Clone or fetch the upstream repo into a temporary directory.
2. Audit its architecture:
   - Supported model formats (GGUF, Hugging Face transformers, MLX where applicable).
   - Fine-tuning entrypoints (CLI, Python API).
   - Quantization and optimization features.
   - License and hardware requirements.
3. Gap analysis: which Unsloth features map to Allternit surfaces and which need new UI.
4. Scaffold a new isolated worker/service, e.g. `services/model-lab/` or `cmd/allternit-model-lab/`.
5. Implement the minimum viable backend:
   - A FastAPI/Flask or Rust wrapper that exposes `/health`, `/models/download`, `/models/train/status`.
   - A small in-memory or SQLite job queue for training jobs.
   - A README with setup, dependencies (`unsloth`, `torch`, etc.), and run instructions.
6. Add Rust API routes in `cmd/allternit-api/src/` that proxy to the worker, or design the proxy contract.
7. Run `cargo check` for any new Rust code and `python -m py_compile` or equivalent for Python.

## Constraints
- Do not import upstream code without a recognized license.
- Keep the worker isolated; do not break existing model surfaces.
- No git operations, no commits, no pushes.

## Deliverable Sentinel
Write `docs/agent-tasks/UNSLOTH_INTEGRATION_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Include: audit summary, feature map, backend design, build/check status, and next-phase work.
