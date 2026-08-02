# Steering checkpoint

## Goal

MLX provider switch in the memory agent (spec: .steering/spec.md R1–R4, task:
docs/MLX_PROVIDER_TASK.md): when `MEMORY_LLM_BASE_URL` is set, generation goes
to the OpenAI-compatible endpoint (`{base}/chat/completions`, model from
`MEMORY_LLM_MODEL` default `qwen3-4b-instruct`) via plain fetch; embeddings
stay on Ollama; no silent fallback; then NOTES + sentinel + prescribed commit.

## Just did

- Implemented the provider switch in `local-model.ts`: optional 3rd ctor arg
  `{ baseUrl?, model? }` → env fallback; private `openAIChat()` via plain
  fetch to `{base}/chat/completions` (OpenAI shape, preset sampling params);
  branch in `generate()`/`generateStream()`. MODEL_PRESETS untouched;
  embeddings untouched (vector-store.ts owns its own Ollama client).
- R3 errors include endpoint + HTTP status; no Ollama fallback mid-config.
- Added `src/models/local-model.test.ts` (vitest + node:http stub): 6/6 pass
  — MLX request shape, default model name, default-unchanged Ollama path,
  non-2xx + unreachable-endpoint errors, embeddings-stay-Ollama.
- Targeted `tsc --noEmit --strict` clean.
- Boot check documented (better-sqlite3 native build broken on Node v26,
  pre-existing). Wrote docs/MLX_PROVIDER_NOTES.md + sentinel.

## Next

The prescribed commit:
`git add services/memory/agent docs .steering && git commit -m "feat(memory): OpenAI-compatible provider for generation (MLX path)"`.
Fix and retry if the gate blocks.

## Open questions

- (none)
