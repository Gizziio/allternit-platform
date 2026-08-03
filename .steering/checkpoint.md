# Steering checkpoint

## Goal

Add a circuit breaker around the memory agent's optional MLX/OpenAI-compatible
generation provider so that repeated endpoint hangs or errors automatically fall
back to Ollama generation for a cooldown window, instead of queueing every
caller into a 120-second timeout.

## Just did

- Added a circuit breaker to `LocalModelManager` in
  `services/memory/agent/src/models/local-model.ts`:
  - Tracks consecutive MLX failures and trips open after a configurable
    threshold (`MEMORY_LLM_BREAKER_THRESHOLD`, default 3).
  - While open, generation skips MLX and goes straight to Ollama for a
    configurable cooldown (`MEMORY_LLM_BREAKER_COOLDOWN_MS`, default 60s).
  - After cooldown, the breaker enters half-open and retries MLX; a success
    closes it again.
  - Added a `breakerProbeInFlight` lock so that in the half-open state only one
    concurrent caller probes MLX; additional callers immediately fall back to
    Ollama.
- Refactored `generate()` and `generateStream()` to route through the breaker.
- Extracted `ollamaChat()` so both the default Ollama path and the MLX
  circuit-breaker fallback share one implementation.
- Updated `ensureModel()` to pull Ollama fallback models even when MLX is
  configured (only skips pulls for MLX-style model IDs containing '/').
- Added per-call backend logging (`LocalModelManager: generation backend=mlx|ollama`)
  so the serving backend is auditable.
- Revised `.steering/spec.md` R3 to explicitly allow Ollama fallback under the
  circuit breaker and require backend provenance tracking.
- Updated `services/memory/agent/src/models/local-model.test.ts` with tests for
  fallback, breaker-open, breaker-close, queue-wedge, and half-open concurrency.
- Verified:
  - `pnpm test`: 33/33 passed.
  - `pnpm typecheck`: clean.

## Files changed

- `services/memory/agent/src/models/local-model.ts`
- `services/memory/agent/src/models/local-model.test.ts`
- `.steering/spec.md`

## Known follow-ups

- Persist the serving backend alongside memory metadata (currently only logged).
- Add per-backend latency + JSON-validity metrics and periodic shadow-mode
  dual-backend comparisons (audit Q5).
- Consider a held-out accuracy eval set for entity/topic/importance extraction
  quality (audit Q3).
