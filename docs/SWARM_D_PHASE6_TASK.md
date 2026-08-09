# Swarm D — Phase 6 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-d`  
**Branch:** `ao/p6-d`  
**Base:** `parity/swarm-sprint`

## Goal
Extend the OpenAI SDK compatibility shim to cover batches and citations.

## Deliverables

1. **OpenAI batches shim**
   - Add `/v1/batches` shim endpoints in `cmd/allternit-api` (or identify existing OpenAI-compat routes) that proxy to the native `BatchesService`.
   - Ensure request/response shapes match OpenAI's batch API contract (`input_file_id`, `endpoint`, `completion_window`, status object, etc.).
   - Map OpenAI batch input file format to the native `requests` array.

2. **OpenAI citations shim**
   - Add a `/v1/chat/completions` option `citations: true` in the OpenAI-compat layer that triggers the native citation/RAG path (Swarm B) when the provider is Anthropic; for OpenAI providers, use the RAG fallback.
   - Surface citations in the response `choices[].message.annotations` field (OpenAI-style) in addition to the native format.

3. **Tests**
   - Add Rust tests for batch shim request/response mapping.
   - Add SDK or API test for citation annotations in OpenAI-compat response.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p6-d` with message: `feat(p6): Swarm D OpenAI SDK compatibility for batches and citations`.
