# Swarm D — Phase 8 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-d`  
**Branch:** `ao/p8-d`  
**Base:** `parity/swarm-sprint`

## Goal
Add agent-level permission policies with approval/deny events.

## Deliverables

1. **Permission policy schema**
   - Add `PermissionPolicy` config type to `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` and `cmd/allternit-api` config.
   - Policies define rules: `tool`, `file_path`, `network_host`, `action` with `allow`/`deny`/`ask`.

2. **Policy engine**
   - Implement a policy evaluator in `cmd/allternit-api/src/tool_routes.rs` (or new module) that checks tool execution requests against active policies.
   - For `ask` decisions, record an `approval_requested` event and return a 202-style response with `approval_id`.
   - Add `POST /beta/approvals/:id/approve` and `POST /beta/approvals/:id/deny` endpoints.

3. **gizzi-code integration**
   - Add `gizzi config permission-profile` commands to manage named permission profiles (already scaffolded; extend with policy DSL import/export).

4. **Tests**
   - Add Rust tests for allow/deny/ask policy outcomes.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p8-d` with message: `feat(p8): Swarm D agent permission policies and approval flow`.
