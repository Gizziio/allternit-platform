# Swarm B — Phase 6 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-b`  
**Branch:** `ao/p6-b`  
**Base:** `parity/swarm-sprint`

## Goal
Close the citations gap with RAG-attribution fallback and PDF page-level citations.

## Deliverables

1. **RAG-attribution fallback for non-Anthropic providers**
   - Add a `CitationsService` in `cmd/allternit-api/src/llm_gateway/citations.rs` that stores retrieved passages with `id`, `title`, `url`, `content`, `score`, and `metadata`.
   - When `StreamRequest.citations` is true and the provider is not Anthropic, prepend a formatted citations context block to the prompt and request the model to cite sources by ID.
   - Parse citation references (e.g. `[cite:abc123]`) from model output and populate `Citation` objects.

2. **PDF page-level citations**
   - Extend `Citation` type in `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` with optional `pageNumber?: number` and `documentTitle?: string`.
   - When parsing Anthropic `citations_delta` events, extract `page_number` from provider data if present.
   - Store `page_number` in `CitationsService` metadata for RAG passages sourced from PDFs.

3. **Tests**
   - Add Rust tests for `CitationsService` storage and retrieval.
   - Add SDK test verifying `Citation` parsing includes page numbers.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p6-b` with message: `feat(p6): Swarm B RAG citations fallback and PDF page-level citations`.
