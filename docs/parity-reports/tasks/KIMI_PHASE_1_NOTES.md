---
status: done
files_changed:
  - cmd/allternit-api/src/admin_workspace_routes.rs
  - cmd/allternit-api/src/llm_gateway/batches.rs
  - cmd/allternit-api/src/llm_gateway/context_cache.rs
  - cmd/allternit-api/src/llm_gateway/mod.rs
  - cmd/allternit-api/src/llm_gateway/proxy.rs
  - cmd/allternit-api/src/llm_gateway/translate.rs
  - surfaces/ai.allternit.com/src/views/playground/main/usePlaygroundManager.ts
blockers: []
---

# Kimi Parity Gaps — Phase 1 Notes

## Summary

All assigned Kimi parity gaps have been implemented as native Allternit features. The agent was briefly blocked by a transient `auth.kimi.com` runtime error; the remaining compile errors were resolved manually and `cargo check -p allternit-api` now passes.

## Implemented Features

### R4: Native Batch Execution
- Extended `cmd/allternit-api/src/llm_gateway/batches.rs` with Kimi-style batch endpoints and status tracking.
- Wired batch routes into the LLM gateway router.

### R5: Token Estimation Endpoint
- Added `/tokens` route in `cmd/allternit-api/src/llm_gateway/mod.rs`.
- Implemented `proxy::count_tokens` in `cmd/allternit-api/src/llm_gateway/proxy.rs`.

### R6: Workspace IP Allowlisting
- Extended `cmd/allternit-api/src/admin_workspace_routes.rs` with workspace-scoped IP allowlist CRUD.

### Context Caching
- Created `cmd/allternit-api/src/llm_gateway/context_cache.rs` with full CRUD routes:
  - `POST /v1/context-caches`
  - `GET /v1/context-caches`
  - `GET /v1/context-caches/:id`
  - `DELETE /v1/context-caches/:id`
- Added `context_cache_id` support to `ChatCompletionRequest` in `translate.rs`.
- Cached messages are prepended to chat-completion requests before forwarding.

### R7: Allternit Playground View
- The existing `PlaygroundView` already provides an Allternit-branded prompt playground.
- `usePlaygroundManager.ts` was updated to support context-cache selection and token estimation display.

## Compile Fixes Applied

- Added `Serialize` to request types in `translate.rs` (`ChatCompletionRequest`, `ChatMessage`, `MessageContent`, `ContentPart`, and related media part types) so cached messages and proxy serialization compile.
- Made `CreateCacheRequest`, `list_caches`, `get_cache`, and `delete_cache` public in `context_cache.rs` so they can be used from `mod.rs`.

## Verification

- `cargo check -p allternit-api` passes with only pre-existing warnings.
- No competitor names remain in code or user-facing strings.

## Phase 2 Remaining Work

- Add integration tests for context-cache endpoints.
- Wire context-cache UI controls into the web surface navigation.
- Add async batch worker progress streaming.
