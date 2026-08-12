# Swarm A — Phase 5 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-a`  
**Branch:** `ao/p5-a`  
**Base:** `parity/swarm-sprint`

## Goal
Close the remaining P0/P1 SDK/harness gaps identified in the Anthropic parity audit.

## Deliverables

1. **Model-specific output limits** (`docs/public/providers/provider-registry.md` says missing)
   - Add a provider registry in `sdk/allternit-sdk/src/ai-runtime/harness/` that maps model IDs to `context_window` and `max_output_tokens`.
   - Export a function `getModelMetadata(provider: string, model: string)`.
   - Wire `StreamRequest.maxTokens` fallback: if the user does not supply `maxTokens`, use the registry's `max_output_tokens`.
   - Add tests.

2. **OpenAI prompt-caching equivalent**
   - In `toOpenAIRequest`, when `cache_control` is present on messages/tools, emit OpenAI's `service_tier: 'flex'` where appropriate and surface cached-token usage in the response parser.
   - Add a test that verifies cache hints are not silently dropped for OpenAI.

3. **Token counting API**
   - Replace the character-count heuristic in `cmd/allternit-api/src/llm_gateway/proxy.rs` `count_tokens` with tiktoken (for OpenAI models) or provider-specific tokenizers.
   - Add a Rust test for token counting.
   - If adding a dependency is problematic, use the `tiktoken-rs` crate or a lightweight tokenizer.

4. **Streaming event types: thinking_delta / signature_delta**
   - Extend `HarnessStreamChunk` in `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` to include `ThinkingDeltaChunk` and `SignatureDeltaChunk`.
   - Parse Anthropic `content_block_delta` events where `delta.type === 'thinking_delta'` or `'signature_delta'` in `sdk/allternit-sdk/src/ai-runtime/harness/index.ts`.
   - Add tests.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass
- `pnpm docs:lint` — pass (update `docs/public/providers/provider-registry.md` after implementation)

## Commit
Commit on `ao/p5-a` with message: `feat(p5): Swarm A model metadata, OpenAI cache hints, token counting, and thinking/signature deltas`.
