# Steering checkpoint

## Goal

Speed up the memory agent's normal ingest and query paths, especially when the
MLX OpenAI-compatible generation provider is configured, while keeping the
Ollama default path unchanged. Add guardrails so a single malformed structured
response does not revert to three slow LLM calls.

## Just did

- Combined `summarize` + `extractEntities` + `assessImportance` into one
  `enrichContent()` structured call in `services/memory/agent/src/models/local-model.ts`,
  cutting generation work per ingest from ~3 LLM passes to ~1.
- Switched `services/memory/agent/src/ingest-agent.ts` to use `enrichContent()`
  for normal ingest; bulk mode still skips LLM enrichment.
- Capped query synthesis context in `services/memory/agent/src/query-agent.ts`
  to the top 5 memories with 200-character summary truncation.
- Added env-var model hooks (`MEMORY_INGEST_MODEL`, `MEMORY_FAST_INGEST_MODEL`,
  `MEMORY_CONSOLIDATE_MODEL`, `MEMORY_QUERY_MODEL`, `MEMORY_EXTRACT_MODEL`) so
  faster/slower models can be swapped without code changes.
- Added strict schema validation and a fast local fallback to `enrichContent()`.
  If the LLM returns malformed JSON, the agent now extracts a local summary,
  keywords, and heuristic importance instead of falling back to three more
  LLM calls.
- Updated `services/memory/agent/src/ingest-agent.test.ts` mock to expect
  `enrichContent()`.
- Verified:
  - `pnpm test`: 30/30 passed.
  - `pnpm typecheck`: clean.
  - Live end-to-end ingest of docs/PROGRAM_FEATURES_AND_ROADMAP.md
    (11KB / 1573 words) on M1 Pro 32GB:
    - MLX Qwen3-4B-4bit via mlx_lm.server: ~10.1s average (5 runs).
    - Ollama qwen3.5:4b (Q4_K_M, llama.cpp): ~44.9s average (5 runs).
    - Direct MLX generation (warm, prompt-cache hit): ~4.9s for the same
      structured JSON; ~40 tok/s effective generation throughput.
  - Steering audit (ao-steer) reviewed the MLX-vs-Ollama rationale and
    recommended schema validation, matched warm comparisons, and a circuit
    breaker. Schema validation and matched comparison are included in this
    change; circuit breaker and shadow-mode monitoring are documented as
    follow-ups.

## Files changed

- `services/memory/agent/src/models/local-model.ts`
- `services/memory/agent/src/ingest-agent.ts`
- `services/memory/agent/src/query-agent.ts`
- `services/memory/agent/src/ingest-agent.test.ts`

## Known follow-ups

- Add a circuit breaker for persistent MLX endpoint hangs (audit Q2).
- Add per-backend latency + JSON-validity metrics and periodic shadow-mode
  dual-backend comparisons (audit Q5).
- Consider a held-out accuracy eval set for entity/topic/importance extraction
  quality (audit Q3).
