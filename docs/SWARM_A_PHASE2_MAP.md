# Swarm A — Core API / Harness — Phase 2 Map

Master handoff: `/Users/joe/Desktop/allternit-parity-handoff.md`

## Scope

1. **SDK retry/backoff interceptor** — Add a provider-agnostic retry interceptor to the SDK harness (`sdk/allternit-sdk/src/ai-runtime/harness/`) with exponential backoff, jitter, and configurable `max_retries`. Wire it around the fetch call in the harness `run()` path. Add offline tests using a stub fetch that fails once then succeeds.

2. **`/rate-limits` endpoint** — Add `GET /v1/rate-limits` to `allternit-api` that returns the caller's current quota state: requests remaining, requests limit, tokens remaining, token limit, reset time. Derive values from the existing quota/budget tables or return sensible defaults if none exist.

3. **Stop-reason taxonomy** — Extend harness run-state/events with normalized stop reasons: `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`. Map provider-specific reasons (OpenAI `finish_reason`, Anthropic `stop_reason`) into this taxonomy in the provider adapters.

4. **Native `functions` array format** — Add an OpenAI-compatible `functions` array output option to `toOpenAIRequest` so callers can request legacy function-calling format instead of tools.

## Known starting files
- `sdk/allternit-sdk/src/ai-runtime/harness/index.ts`
- `sdk/allternit-sdk/src/ai-runtime/harness/provider-request.ts`
- `sdk/allternit-sdk/src/ai-runtime/harness/run-state.ts`
- `cmd/allternit-api/src/llm_gateway/`
- `cmd/allternit-api/src/main.rs`

## Constraints
- Do NOT start Phase 3 work.
- Do NOT run builds, dev servers, or tests that require external services.
- Match existing repo idioms.
- Work only in `/Users/joe/Desktop/allternit-parity-p2-swarm-a`.
