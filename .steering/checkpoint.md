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

- Added `scripts/eval-extraction.ts` and `data/eval-extraction.json` with four
  labeled cases covering product releases, critical outages, architecture
  decisions, and routine notes. The script computes entity F1, topic F1, and
  importance accuracy, and reports an overall score.
- Initial eval run (MLX Qwen3-4B): overall score 0.55, entity F1 0.77,
  topic F1 0.39, importance accuracy 0.50.
- Initial eval run (Ollama qwen3.5:2b/4b): overall score 0.43, entity F1 0.41,
  topic F1 0.12, importance accuracy 0.75 (with local fallback on malformed
  JSON).
- Verified:
  - `pnpm test`: 36/36 passed.
  - `pnpm typecheck`: clean.
  - Eval script runs against both MLX and Ollama backends.

## Files changed

- `services/memory/agent/src/models/local-model.ts`
- `services/memory/agent/src/ingest-agent.ts`
- `services/memory/agent/src/ingest-agent.test.ts`
- `services/memory/agent/src/models/local-model.test.ts`
- `services/memory/agent/src/orchestrator.ts`
- `services/memory/agent/src/http-server.ts`
- `services/memory/agent/scripts/eval-extraction.ts`
- `services/memory/agent/data/eval-extraction.json`
- `.steering/spec.md`

## Known follow-ups

- Add a scheduled/periodic shadow comparison job (currently available on-demand via HTTP).
- Expand the eval set with more cases and finer-grained scoring (e.g., partial entity matches).
