# Swarm E — Phase 6 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-e`  
**Branch:** `ao/p6-e`  
**Base:** `parity/swarm-sprint`

## Goal
Enable prompt caching on tool definitions and tool results.

## Deliverables

1. **Tool definition caching**
   - `Tool.cache` and `Tool.cache_control` are already in types; verify they are emitted in `toAnthropicRequest` and `toOpenAIRequest`.
   - Add a test that confirms tool-level `cache_control` is passed through to Anthropic requests.

2. **Tool result caching**
   - Extend the tool result schema to allow `cache_control` on tool results.
   - In the API tool dispatcher (`cmd/allternit-api/src/tool_routes.rs` or equivalent), when a tool result is large and the session/request enables caching, attach `cache_control: { type: 'ephemeral' }` to the result block returned to the model.
   - For Anthropic, return tool results as content blocks with `cache_control` when applicable.

3. **Tests**
   - Add SDK test for tool result caching in Anthropic request output.
   - Add Rust test for dispatcher attaching cache hints to large results.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p6-e` with message: `feat(p6): Swarm E cache_control on tool definitions and results`.
