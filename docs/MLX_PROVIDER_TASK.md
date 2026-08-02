# TASK — MLX provider switch in the memory agent

You are the executor. `.steering/spec.md` (R1–R4 + acceptance) is the source
of truth. Target: services/memory/agent/src/models/local-model.ts (+ its
callers/tests). Small, surgical provider addition.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] authoritative.
2. Done → `docs/MLX_PROVIDER_NOTES.md` with YAML frontmatter, then
   `touch docs/MLX_PROVIDER_NOTES.sentinel`.
3. Then commit: `git add services/memory/agent docs .steering && git commit -m "feat(memory): OpenAI-compatible provider for generation (MLX path)"`.
   A gate reviews; fix and retry if blocked.

## Build guidance

1. Read local-model.ts fully (MODEL_PRESETS, generate path, embeddings path)
   and its callers in http-server.ts/orchestrator.ts.
2. Add a provider layer: when `MEMORY_LLM_BASE_URL` is set, generation goes
   to `{base}/chat/completions` (OpenAI shape: model from
   `MEMORY_LLM_MODEL` default 'qwen3-4b-instruct', temperature/numPredict
   from the preset) via plain fetch — no new deps. Embeddings always Ollama.
3. R3: non-2xx or network error → throw with endpoint + status in the
   message; no fallback to Ollama mid-config.
4. Tests: a stub HTTP server (node http) asserting request shape for both
   configured and default paths; embeddings-stays-Ollama assertion. Find the
   existing test convention in services/memory/agent (or add a small
   local-model.test.ts run via the repo's runner — check package.json).
5. Verify the service starts with the env set (short boot check) or document.

## Constraints

- No new npm dependencies. No changes to MODEL_PRESETS values (env wins).
- Surgical: models/local-model.ts + its test only.
