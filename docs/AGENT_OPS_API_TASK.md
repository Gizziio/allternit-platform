# Task: Implement /api/v1/agents/operations/* in allternit-api (Rust/axum)

The platform settings UI (`surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx`) calls an agent-operations API that was never implemented in `cmd/allternit-api` — it currently falls back to sample data. Implement the routes so the Agents settings section runs on real persisted data.

## Contract (derive exact response shapes by READING AgentOpsPanel.tsx — its `api` helper object and the setters consuming each response are the source of truth)

- `GET  /api/v1/agents/operations/evaluations` — list evaluations
- `POST /api/v1/agents/operations/evaluations` — create (name, target, dataset optional)
- `POST /api/v1/agents/operations/evaluations/:id/run` — start a run; v1 may synthesize a completed run with computed scores
- `GET  /api/v1/agents/operations/evaluations/:id/results` — run results
- `GET  /api/v1/agents/operations/benchmarks/history`
- `GET  /api/v1/agents/operations/factory/tasks`
- `POST /api/v1/agents/operations/factory/tasks` — create (specRef, requirements)
- `POST /api/v1/agents/operations/factory/tasks/:taskId/changes/:changeId/approve`
- `POST /api/v1/agents/operations/factory/tasks/:taskId/changes/:changeId/reject`
- `GET  /api/v1/agents/operations/gc/queue`
- `GET  /api/v1/agents/operations/gc/policies`
- `PUT  /api/v1/agents/operations/gc/policies/:id` — partial update (enabled, threshold)
- `POST /api/v1/agents/operations/gc/cleanup` — run all enabled GC agents
- `GET  /api/v1/agents/operations/gc/history`
- `POST /api/v1/agents/operations/gc/agents/:agentName/run` — run one GC agent (names in `GC_AGENT_INFO` in AgentOpsPanel.tsx)

## Implementation requirements

1. New file `cmd/allternit-api/src/agent_operations_routes.rs`, exporting `agent_operations_router() -> Router<Arc<AppState>>`. Follow `task_routes.rs` as the idiom template exactly: axum extractors, `AuthUser`/`get_user` auth, rusqlite via AppState, serde types, `tracing::error`.
2. New migration in `cmd/allternit-api/migrations/` (follow existing naming) creating tables: `agent_evaluations`, `agent_evaluation_runs`, `factory_tasks`, `factory_changes`, `gc_policies`, `gc_runs`. Seed `gc_policies` with the six agents named in `GC_AGENT_INFO` (enabled=true, sensible thresholds).
3. Register the module in `cmd/allternit-api/src/lib.rs` (match how task_routes is declared) and `.merge(agent_operations_router())` in the main.rs router chain next to `task_routes::task_router()`.
4. "Running" an evaluation or GC agent in v1 is a synchronous synthetic execution: generate a plausible result record (scores/issues computed from stored data + randomness), persist it, return it. Mark these clearly with a `// v1: synthetic execution` comment so the real engine can replace them.
5. Handle not-found ids with 404 JSON, bad payloads with 422 — same style as task_routes.

## Verification allowed
- You may run exactly `nice -n 19 cargo check -p allternit-api` to validate compilation. NOTHING else: no `cargo build`, no workspace-wide check, no tests, no dev servers, no other builds. If `cargo check -p allternit-api` fails for pre-existing reasons unrelated to your change, note it and verify your file by reading.

## Other constraints
- No git operations.
- Do not modify AgentOpsPanel.tsx or anything under surfaces/ — the backend must conform to the frontend contract, not vice versa.
- Do not touch other route files beyond the two registration lines.

## Deliverable
`docs/AGENT_OPS_API_NOTES.md`, starting with YAML frontmatter:
```yaml
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
```
then prose: route list implemented, storage schema, how synthetic execution works, cargo check outcome. That file existing = done.
