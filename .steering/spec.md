# Steering spec — MLX provider for the memory agent's generation tasks

## Requirements

- [ ] R1: WHEN `MEMORY_LLM_BASE_URL` is set (e.g. http://localhost:8080/v1),
  THE SYSTEM SHALL route generation tasks (ingest, consolidate, query,
  extract) to the OpenAI-compatible endpoint using the preset model names
  mapped via `MEMORY_LLM_MODEL` (single model for all generation tasks), and
  embeddings SHALL remain on Ollama.
- [ ] R2: WHEN `MEMORY_LLM_BASE_URL` is unset, THE SYSTEM SHALL behave exactly
  as today (Ollama generate path, MODEL_PRESETS names).
- [ ] R3: WHEN the MLX endpoint is unreachable or returns hard errors mid-request
  and no fallback is configured, THE SYSTEM SHALL fail the request with a clear
  error. WHEN a circuit breaker is active, THE SYSTEM MAY fall back to the
  configured Ollama generation model after repeated hard failures, and SHALL
  record the serving backend so fallback-enriched memories remain auditable.
- [ ] R4: WHEN local-model.ts is changed, THE SYSTEM SHALL keep its existing
  callers working (http-server.ts, orchestrator.ts) with no signature
  changes beyond optional config, and unit-test the provider switch.

## Speed + guardrail requirements (MLX or Ollama)

- [ ] R5: WHEN normal ingest enriches a memory, THE SYSTEM SHALL use a single
  structured LLM call (`enrichContent()`) for summary + entities + topics +
  importance instead of three separate calls.
- [ ] R6: WHEN the structured enrichment call returns malformed JSON or fields
  of the wrong type, THE SYSTEM SHALL fall back to a fast local extraction
  (truncated summary, keyword-derived entities/topics, heuristic importance)
  and SHALL NOT emit additional LLM calls.
- [ ] R7: WHEN a query is synthesized, THE SYSTEM SHALL cap the synthesis
  context to the top 5 retrieved memories with summaries truncated to 200
  characters.
- [ ] R8: WHEN generation model presets are overridden via environment
  variables (`MEMORY_INGEST_MODEL`, `MEMORY_FAST_INGEST_MODEL`, etc.), THE
  SYSTEM SHALL use the overridden names without requiring code changes.
- [ ] R9: WHEN the configured MLX/OpenAI-compatible generation endpoint fails
  repeatedly, THE SYSTEM SHALL trip a circuit breaker after a configurable
  threshold and fall back to Ollama generation for a cooldown window, without
  manual intervention.
- [ ] R10: WHEN a memory is enriched, THE SYSTEM SHALL record the serving
  generation backend (`mlx`, `ollama`, or `local`) in the memory's metadata.
- [ ] R11: WHEN generation calls complete, THE SYSTEM SHALL track per-backend
  call counts, failures, and average latency, and expose them via `getMetrics()`.
- [ ] R12: WHEN requested, THE SYSTEM SHALL run the same prompt through both
  MLX and Ollama and return both responses for comparison (shadow mode).

## Acceptance (Gherkin)

- Scenario: MLX path used when configured
  Given MEMORY_LLM_BASE_URL set to a stub OpenAI server
  When a generate task runs
  Then the request hits /v1/chat/completions with the MEMORY_LLM_MODEL name,
  and embeddings still hit Ollama.
- Scenario: default unchanged
  Given the env unset
  When a generate task runs
  Then Ollama is used with the preset model name.
- Scenario: fast ingest uses one LLM call
  Given a normal ingest request
  When enrichment runs
  Then exactly one structured generation call is made.
- Scenario: malformed structured output degrades safely
  Given a normal ingest request where the LLM returns invalid JSON
  When enrichment runs
  Then no further LLM calls are made and a memory is still created.
- Scenario: query synthesis stays small
  Given a query that retrieves many memories
  When synthesis runs
  Then at most 5 memories are included and each summary is at most 200 chars.
- Scenario: MLX circuit breaker falls back to Ollama
  Given MEMORY_LLM_BASE_URL is set and the MLX endpoint returns errors
  When generation fails N consecutive times
  Then generation falls back to Ollama and skips MLX until the cooldown passes.
- Scenario: backend provenance is stored with each memory
  Given a normal ingest request
  When the memory is created
  Then metadata.enrichment_backend is set to mlx, ollama, or local.
- Scenario: backend metrics are observable
  Given generation calls have run
  When getMetrics() is called
  Then per-backend calls, failures, and avgLatencyMs are returned.
- Scenario: shadow comparison runs both backends
  Given a prompt and MEMORY_LLM_BASE_URL set
  When shadowCompare() is called
  Then both mlx and ollama responses are returned.
