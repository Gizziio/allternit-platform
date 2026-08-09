# Swarm E — Phase 5 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-e`  
**Branch:** `ao/p5-e`  
**Base:** `parity/swarm-sprint`

## Goal
Make the Batch Messages API actually execute provider-side batch jobs.

## Deliverables

1. **Batch provider execution/polling**
   - Extend `BatchesService` in `cmd/allternit-api/src/llm_gateway/batches.rs` to submit stored requests to the configured LLM provider's batch endpoint (OpenAI `/v1/batches` or generic HTTP batch API).
   - Add a background worker that polls batch status and writes `results_json`.
   - For this phase, use a simple in-process tokio task spawned at API startup; do not require an external worker.
   - Add `status` transitions: `validating` → `in_progress` → `completed`/`failed`/`cancelled`.

2. **Batch error handling**
   - Define a batch error schema (per-request error objects with `index`, `code`, `message`).
   - Add batch retry for transient provider errors (up to 3 attempts).
   - Update `GET /v1/batches/:id/results` to return errors alongside outputs.
   - Add tests.

3. **Update docs**
   - Update `docs/public/api/reference.md` batch section to reflect execution and results format.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p5-e` with message: `feat(p5): Swarm E batch execution, polling, and error handling`.
