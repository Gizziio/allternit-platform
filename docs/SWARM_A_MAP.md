# Swarm A — Core API / Harness — Map

This is the context map for Swarm A — Core API / Harness. The master handoff checklist is at:
`/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope for Phase 0
- Add normalized reasoning/thinking parameters to AllternitHarness ( Anthropic `thinking`, OpenAI `reasoning_effort`, Kimi `thinking` ).
- Add prompt/context caching markers (`cache_control` / `cache`) to messages/system/tools and pass through to providers.
- Add native `response_format: {type: json_schema, schema: ...}` support across providers.
- Normalize tool_calls, tool_choice, parallel tools, and strict mode in the Tool Belt contract.
- Add Idempotency-Key middleware and a standardized Allternit error-code taxonomy in allternit-api gateway.
- Add per-model `maxOutputTokens` / context-window metadata to the provider registry and enrich `/v1/models`.

## Known starting files
- `cmd/allternit-api/src/llm_gateway/translate.rs`
- `cmd/allternit-api/src/main.rs`
- `cmd/allternit-api/src/auth.rs`
- `surfaces/ai.allternit.com/src/lib/ai/ai-gateway-models-schemas.ts`
- `surfaces/ai.allternit.com/src/lib/ai/models.generated.ts`

## Constraints
- Do NOT start Phase 1 work yet.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms (naming, module structure, error handling).
- Do NOT mutate the canonical repo; work only in `/Users/joe/Desktop/allternit-parity-swarm-a`.
