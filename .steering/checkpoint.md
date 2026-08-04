# Steering checkpoint

## Goal

Close the follow-ups from the MLX speedup/circuit-breaker work:
1. Persist the generation backend (`mlx`/`ollama`/`local`) in memory metadata.
2. Add per-backend latency/failure metrics and a shadow-mode comparison helper.
3. Expose metrics and shadow comparison via the HTTP API.
4. Finish ingesting the taste/wiki corpus into the MLX-backed memory server.
5. Create a small accuracy eval set for entity/topic/importance extraction.

## Just did

- `enrichContent()` now returns the serving backend alongside summary/entities/topics/importance.
- `IngestAgent.ingestContent()` stores `enrichment_backend` in `memory.metadata` for both normal and bulk modes.
- `LocalModelManager` tracks per-backend metrics (calls, failures, total/avg latency) via `recordLatency()` and exposes them via `getMetrics()`.
- Added `LocalModelManager.shadowCompare(prompt, systemPrompt?, config?)` to run the same prompt through MLX and Ollama for quality monitoring.
- Added HTTP endpoints:
  - `GET /metrics/backends` — MLX/Ollama generation metrics.
  - `POST /shadow-compare` — run a prompt through both backends.
- Added `MemoryOrchestrator.getModelManager()` so diagnostics endpoints can reach the model manager.
- Updated `ingest-agent.test.ts` mock and added assertions for backend metadata.
- Added `local-model.test.ts` tests for backend reporting, metrics tracking, and shadow comparison.
- Verified:
  - `pnpm test`: 36/36 passed.
  - `pnpm typecheck`: clean.

## Files changed

- `services/memory/agent/src/models/local-model.ts`
- `services/memory/agent/src/ingest-agent.ts`
- `services/memory/agent/src/ingest-agent.test.ts`
- `services/memory/agent/src/models/local-model.test.ts`
- `services/memory/agent/src/orchestrator.ts`
- `services/memory/agent/src/http-server.ts`
- `.steering/spec.md`

## Known follow-ups

- Add a scheduled/periodic shadow comparison job (currently available on-demand via HTTP).
- Consider a held-out accuracy eval set for entity/topic/importance extraction quality (audit Q3).
