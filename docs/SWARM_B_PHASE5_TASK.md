# Swarm B — Phase 5 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-b`  
**Branch:** `ao/p5-b`  
**Base:** `parity/swarm-sprint`

## Goal
Close agent-runtime context-management gaps.

## Deliverables

1. **Long-context optimizations / Context editing**
   - Add context-window management to `/beta/sessions`.
   - When a session's cumulative token count approaches the model's context window, emit a `context_warning` event before `budget_exceeded`.
   - Add automatic truncation strategies: `drop_oldest_user`, `summarize`, `none`.
   - Expose `POST /beta/sessions/:id/context/edit` to allow server-side context editing (delete or summarize message ranges).
   - Add tests in `beta_session_routes.rs`.

2. **Search results content block**
   - Add a typed `search_result` content block to the harness `Message` schema in `sdk/allternit-sdk/src/ai-runtime/harness/types.ts`.
   - Support `title`, `url`, `content`, and `score` fields.
   - In `toAnthropicRequest`, map `search_result` blocks to Anthropic's `document`/`content` shape or text with citation markers.
   - Add a test.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p5-b` with message: `feat(p5): Swarm B context editing and search-results content block`.
