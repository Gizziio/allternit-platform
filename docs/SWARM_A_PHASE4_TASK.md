# Swarm A — Phase 4 Docs / GTM Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-a`  
**Branch:** `ao/p4-swarm-a`  
**Base:** `parity/swarm-sprint`

## Goal
Produce public-facing API, provider-parity, and request-lifecycle documentation for everything Swarm A built in Phases 0–3.

## Deliverables (all under `docs/public/` unless noted)

1. `docs/public/api/reference.md` — API reference covering:
   - `POST /v1/chat/completions` and streaming (` HarnessStreamChunk` events)
   - `POST /v1/batches`, `GET /v1/batches/:id`, `POST /v1/batches/:id/cancel`, `GET /v1/batches/:id/results`
   - `POST /v1/tokens`
   - `GET /v1/rate-limits`
   - `Idempotency-Key` header behavior and `409 Conflict` semantics
   - `AllternitEmbeddings.create` SDK usage
   - Include at least one copy-pasteable `curl` example per endpoint.

2. `docs/public/providers/parity-matrix.md` — 1-to-1 mapping table:
   - Anthropic concepts (`cache_control`, `thinking`, `tool_choice`, `parallel_tool_calls`, citations, batch, `computer_20250124`, `text_editor_20250124`) → Allternit API/SDK field/parameter.
   - OpenAI concepts (`reasoning_effort`, `response_format json_schema`, `functions`/`function_call`, batch) → Allternit equivalent.
   - Kimi concepts (long context, tool use, response format) → Allternit equivalent.

3. `docs/public/providers/provider-registry.md` — per-model metadata added in Phase 0:
   - `context_window`, `max_output_tokens`, supported features, stop-reason taxonomy.

4. `docs/public/guides/idempotency-and-retries.md` — explain `Idempotency-Key`, `Retry-After`, SDK `fetchWithRetry` interceptor.

5. Update `README.md` lines 249–309 (Build Instructions / Service Ports) to reflect current commands (`cargo run -p allternit-api`, `gizzi`, `pnpm dev:platform-stack`) and ports actually in use.

6. Add `docs/public/guides/migration-from-openai.md` and `docs/public/guides/migration-from-anthropic.md` with before/after request snippets.

## Validation
- Run `cargo check -p allternit-api` (must pass).
- Run `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` (must still pass; no code changes should break tests).
- Verify every new `.md` has a H1 title and at least one runnable code block.

## Commit
Commit all changes on `ao/p4-swarm-a` with message: `docs(p4): Swarm A API reference, provider parity matrix, and migration guides`.
