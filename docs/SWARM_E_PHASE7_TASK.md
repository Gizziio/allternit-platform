# Swarm E — Phase 7 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-e`  
**Branch:** `ao/p7-e`  
**Base:** `parity/swarm-sprint`

## Goal
Complete the inference hooks subsystem.

## Deliverables

1. **Hook execution engine**
   - The inference hooks config scaffold exists from Phase 1 (`inference_hooks` organization config + pre/post middleware).
   - Implement actual HTTP hook calls in `cmd/allternit-api/src/llm_gateway/proxy.rs` before and after provider inference.
   - Pre-hook receives request body and can mutate it or abort with a configured response.
   - Post-hook receives request + response and can mutate response or abort.
   - Add timeout (5s default), retry (1 retry), and signature header (`X-Allternit-Hook-Signature` HMAC-SHA256 with org secret).

2. **Admin UI / CLI**
   - Add `POST /api/v1/admin/inference-hooks` CRUD to manage org-level hooks (already scaffolded; complete update/delete).
   - Add `allternit admin inference-hooks list|create|update|delete` CLI commands.

3. **Tests**
   - Add Rust tests for pre-hook mutation, post-hook mutation, and abort behavior.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p7-e` with message: `feat(p7): Swarm E inference hooks execution engine and admin CLI`.
