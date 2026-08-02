# Steering spec — MLX provider for the memory agent's generation tasks

## Requirements

- [ ] R1: WHEN `MEMORY_LLM_BASE_URL` is set (e.g. http://localhost:8080/v1),
  THE SYSTEM SHALL route generation tasks (ingest, consolidate, query,
  extract) to the OpenAI-compatible endpoint using the preset model names
  mapped via `MEMORY_LLM_MODEL` (single model for all generation tasks), and
  embeddings SHALL remain on Ollama.
- [ ] R2: WHEN `MEMORY_LLM_BASE_URL` is unset, THE SYSTEM SHALL behave exactly
  as today (Ollama generate path, MODEL_PRESETS names).
- [ ] R3: WHEN the MLX endpoint is unreachable mid-request, THE SYSTEM SHALL
  fail the request with a clear error (no silent fallback to a different
  model — wrong-model answers are worse than failed ones).
- [ ] R4: WHEN local-model.ts is changed, THE SYSTEM SHALL keep its existing
  callers working (http-server.ts, orchestrator.ts) with no signature
  changes beyond optional config, and unit-test the provider switch.

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
