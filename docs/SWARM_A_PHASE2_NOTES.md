---
status: done
files_changed:
  - sdk/allternit-sdk/src/ai-runtime/harness/types.ts
  - sdk/allternit-sdk/src/ai-runtime/harness/provider-request.ts
  - sdk/allternit-sdk/src/ai-runtime/harness/index.ts
  - sdk/allternit-sdk/src/ai-runtime/harness/run-state.ts
  - sdk/allternit-sdk/src/ai-runtime/harness/__tests__/harness.test.ts
  - sdk/allternit-sdk/src/ai-runtime/harness/__tests__/provider-request.test.ts
  - cmd/allternit-api/src/llm_gateway/auth.rs
  - cmd/allternit-api/src/llm_gateway/mod.rs
  - cmd/allternit-api/src/llm_gateway/proxy.rs
  - docs/SWARM_A_PHASE2_MAP.md
  - docs/SWARM_A_PHASE2_TASK.md
deviations:
  - The /v1/rate-limits endpoint returns token quota values in cents because the existing quota/budget tables (llm_budgets, llm_usage_events) model spend in cents/microdollars, not a raw token count. tokens_remaining/tokens_limit are null when no budget cap is configured (i.e., unlimited).
  - Did not fix pre-existing SDK failures outside the harness/__tests__ directory (missing zod dependency and unimplemented Google/Local/subprocess streaming paths) because they are outside the Phase 2 scope.
remaining:
  - Implement Google Gemini, local OpenAI-compatible, and subprocess streaming paths in the SDK harness so the broader SDK test suite passes.
  - Wire fetchWithRetry into the remaining provider paths once they are implemented.
  - Add an integration test for GET /v1/rate-limits using a real AppState when a lightweight router-test harness is available.
  - Resolve the missing zod dependency that causes src/ai-runtime/__tests__/index.test.ts and full-integration.test.ts to fail.
---

# Swarm A — Phase 2 Completion Notes

## What changed

1. **SDK retry/backoff interceptor**
   - `retry.ts` was already implemented by the previous agent. I verified its behavior and wired `fetchWithRetry(..., this.config.retry)` into the Anthropic BYOK path in `harness/index.ts`.
   - Existing `retry.test.ts` covers success, network-error retry, 429 retry, non-retryable 4xx, and exhaustion paths.

2. **`GET /v1/rate-limits`**
   - Added read-only helpers in `cmd/allternit-api/src/llm_gateway/auth.rs`:
     - `rate_limit_status(key_id, limit)` — returns remaining requests and seconds-until-reset from the in-memory sliding window without mutating it.
     - `token_budget_status(conn, ctx)` — returns the effective monthly budget and remaining spend in cents, combining the key-level cap and the tenant hard cap.
   - Added `proxy::rate_limits` handler and registered `/rate-limits` on the public LLM gateway router in `mod.rs`.
   - Added unit tests for both helpers in `auth.rs`.

3. **Stop-reason taxonomy**
   - Added `HarnessStopReason` union type (`end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`) to `harness/types.ts`.
   - Added `stopReason` to `DoneChunk` and `HarnessResponse`.
   - Added `mapStopReason(provider, raw)` in `provider-request.ts` to normalize Anthropic `stop_reason` and OpenAI `finish_reason` values.
   - Updated the Anthropic streaming path in `harness/index.ts` to capture `stop_reason` from `message_delta`/`message_stop` events and yield it in the final `done` chunk.
   - Updated `harness.run()` to return the captured `stopReason`.
   - Extended `RunState` in `run-state.ts` with `recordStopReason(reason)` which emits a `run.stop` lifecycle event.

4. **Native `functions` array format**
   - Added `functions?: FunctionDefinition[]` to `StreamRequest`.
   - Updated `toOpenAIRequest` to emit legacy `functions`/`function_call` when `functions` is provided, falling back to the modern `tools`/`tool_choice` format otherwise.
   - Added comprehensive tests in `provider-request.test.ts`.

## Test results

- `bun test src/ai-runtime/harness/__tests__` in `sdk/allternit-sdk`: **51 passed, 0 failed**.
- `cargo check -p allternit-api`: **clean** (only pre-existing warnings).
- `cargo test -p allternit-api --lib`: **136 passed, 0 failed**.

## Blockers / follow-ups

No blockers for the committed Phase 2 work. The broader `bun test` run in `sdk/allternit-sdk` still fails because of pre-existing issues not in scope:

- Missing `zod` dependency breaks `src/ai-runtime/__tests__/index.test.ts` and `full-integration.test.ts`.
- `src/ai-runtime/__tests__/harness-streaming.test.ts` expects Google Gemini and local/Ollama streaming implementations that are still TODO stubs.

These are recorded in `remaining` above for Phase 3 or a follow-up hygiene pass.
