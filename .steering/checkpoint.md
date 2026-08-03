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
- Refactored `generate()` and `generateStream()` to route through the breaker.
- Extracted `ollamaChat()` so both the default Ollama path and the MLX
  circuit-breaker fallback share one implementation.
- Updated `ensureModel()` to pull Ollama fallback models even when MLX is
  configured (only skips pulls for MLX-style model IDs containing '/').
- Updated `services/memory/agent/src/models/local-model.test.ts` with four new
  tests covering fallback, breaker-open, breaker-close, and queue-wedge cases.
- Verified:
  - `pnpm test`: 32/32 passed.
  - `pnpm typecheck`: clean.

## Files changed

- `services/memory/agent/src/models/local-model.ts`
- `services/memory/agent/src/models/local-model.test.ts`
- `.steering/spec.md`

## Known follow-ups

- Add per-backend latency + JSON-validity metrics and periodic shadow-mode
  dual-backend comparisons (audit Q5).
- Consider a held-out accuracy eval set for entity/topic/importance extraction
  quality (audit Q3).
