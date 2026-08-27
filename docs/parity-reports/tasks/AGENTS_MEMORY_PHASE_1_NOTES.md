---
status: done
files_changed:
  - cmd/allternit-api/src/eval_routes.rs
  - cmd/allternit-api/src/eval_metrics.rs
  - cmd/allternit-api/src/memory_reconstruction_routes.rs
  - cmd/allternit-api/src/lib.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/src/beta_session_routes.rs
  - cmd/allternit-api/migrations/V83__memory_reconstruction_jobs.sql
  - cmd/gizzi-code/src/cli/ui/ink-app/services/SessionMemory/search.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/commands/memory-search/index.ts
  - cmd/gizzi-code/src/cli/ui/ink-app/commands/memory-search/memory-search.tsx
  - cmd/gizzi-code/src/cli/ui/ink-app/commands.ts
  - surfaces/ai.allternit.com/src/nav/nav.types.ts
  - surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx
  - surfaces/ai.allternit.com/src/views/AllternitPlaygroundView.tsx
  - surfaces/ai.allternit.com/src/views/AgentStudioView.tsx
blockers: []
---

# Agents Sessions and Memory — Phase 1 Notes

## Summary

Phase 1 implements durable scaffolding and UI surfaces for the Agents Sessions and Memory parity track. All steering-spec requirements (R1–R5) now have code evidence in the worktree.

## What was implemented

### C6 — Evals & graders user-defined CRUD

- `cmd/allternit-api/src/eval_routes.rs`
  - Added `validate_rubric_id` helper.
  - `POST /admin/eval/runs` now validates that a provided `rubric_id` exists and belongs to the caller's organization.
  - Added `POST /admin/eval/runs/:id/grade` to apply the run's rubric (or an override) and persist per-criterion grades under `scores.rubric_grades`.
- `cmd/allternit-api/src/eval_metrics.rs`
  - Added `score_rubric_criteria` and a `TryFrom<&str>` for `BuiltinMetric` so rubric criteria can reference built-in metrics directly.

### C5 — Memory reconstruction jobs

- `cmd/allternit-api/src/memory_reconstruction_routes.rs` (new)
  - Full CRUD for `/beta/memory-reconstruction`.
  - `POST /beta/memory-reconstruction/:id/run` runs a synchronous Phase 1 scaffold that produces a deterministic memory outline; Phase 2 will replace this with an async worker.
  - Includes unit test for the job lifecycle.
- `cmd/allternit-api/migrations/V83__memory_reconstruction_jobs.sql` (new)
  - Creates `memory_reconstruction_jobs` table with org-scoped isolation and source indexes.
- Wired into `cmd/allternit-api/src/lib.rs` and `cmd/allternit-api/src/main.rs`.

### C4 — Session memory search

- `cmd/gizzi-code/src/cli/ui/ink-app/services/SessionMemory/search.ts` (new)
  - `searchSessionMemory(query, options)` performs local full-text search over the session memory markdown file and returns ranked section matches.
- `cmd/gizzi-code/src/cli/ui/ink-app/commands/memory-search/` (new)
  - Adds `/memory-search` slash command that renders results in the TUI.
- `cmd/gizzi-code/src/cli/ui/ink-app/commands.ts`
  - Registered the new `memorySearch` command.
- `cmd/allternit-api/src/beta_session_routes.rs`
  - Added `GET /beta/sessions/:id/memory/search` and `GET /beta/sessions/:id/events/list` for the web surface to query session data.

### C7 — Allternit Playground

- `surfaces/ai.allternit.com/src/views/AllternitPlaygroundView.tsx` (new)
  - Branded debugging surface with tabs for Prompt, Memory search, Tool selection, and Event replay.
  - Calls the new session memory search and event-list endpoints.

### C8 — Agent Studio

- `surfaces/ai.allternit.com/src/views/AgentStudioView.tsx` (new)
  - Branded agent prototyping surface with Agent config, Tool selection, and a Test/Run tab.
  - Saves are simulated in Phase 1; the prototype run posts to `/api/v1/agents/prototype` and degrades gracefully to showing the request payload if the endpoint is not yet implemented.

### Surface wiring

- `surfaces/ai.allternit.com/src/nav/nav.types.ts`
  - Added `"allternit-playground"` and `"agent-studio"` view types.
- `surfaces/ai.allternit.com/src/shell/ViewRegistry.tsx`
  - Lazy-loaded and registered both new views with error boundaries.

## Verification

- `cargo check -p allternit-api` completes successfully with only pre-existing/unrelated warnings.
- Rust unit tests pass:
  - `cargo test -p allternit-api memory_reconstruction` — 1 passed
  - `cargo test -p allternit-api eval` — 12 passed
  - `cargo test -p allternit-api beta_session` — 12 passed
- TypeScript checks were not run because `node_modules` is not installed in this worktree.

## Phase 2 remaining work

- Replace the synchronous memory reconstruction scaffold with an async worker and progress streaming.
- Implement `/api/v1/agents/prototype` and `/api/v1/beta/sessions/:id/run` backend endpoints.
- Add semantic/embedding-based session memory search in addition to the current keyword search.
- Wire the new web views into the platform navigation/sidebar so users can open them without a direct view context.
- Add end-to-end tests for the new API routes and UI views.
