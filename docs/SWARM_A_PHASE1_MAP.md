# Swarm A — Core API / Harness — Phase 1 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **Batch Messages API scaffold** — Add a `BatchesService` in `allternit-api` with a SQLite migration, internal model, and `/v1/batches` REST endpoints:
   - `POST /v1/batches` — create a batch from a list of requests.
   - `GET /v1/batches` — list batches for the caller.
   - `GET /v1/batches/:id` — retrieve batch metadata.
   - `POST /v1/batches/:id/cancel` — mark a batch as cancelled.
   - `GET /v1/batches/:id/results` — return stored results (initially empty until Phase 2 polling).
   Do NOT implement provider-side polling or result backfill in Phase 1.

2. **Citations schema + Anthropic pass-through** — Add a provider-agnostic `citation` type to the harness, wire Anthropic's `citations` option through `toAnthropicRequest`, and return citations in stream/run events where the provider supplies them.

3. **Token counting endpoint** — Add `POST /v1/tokens` that accepts a request body identical to `/v1/chat/completions` and returns a token count using a deterministic heuristic or existing tokenizer utility.

4. **Embeddings harness method** — Add `AllternitEmbeddings.create({ model, input })` in the SDK that routes to provider embeddings endpoints (OpenAI first) with the same BYOK/auth model as chat completions.

## Known starting files
- `cmd/allternit-api/src/llm_gateway/`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/lib.rs`
- `sdk/allternit-sdk/src/ai-runtime/harness/`
- `sdk/allternit-sdk/src/ai-runtime/__tests__/`

## Constraints
- Do NOT start Phase 2 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p1-swarm-a`.
