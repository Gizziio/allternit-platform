---
status: done
files_changed: [cmd/allternit-api/src/agent_operations_routes.rs, cmd/allternit-api/migrations/V18__agent_operations.sql, cmd/allternit-api/src/lib.rs, cmd/allternit-api/src/main.rs, docs/AGENT_OPS_API_NOTES.md]
deviations: []
remaining: []
---

# Agent Operations API implementation

Implemented the authenticated `/api/v1/agents/operations/*` API used by `AgentOpsPanel.tsx`:

- Evaluation list/create, synchronous run, latest results, and benchmark history.
- Factory task list/create and change approval/rejection.
- GC queue, policies, partial policy updates, full cleanup, history, and individual agent runs.

Responses follow the frontend's consumed shapes, including the list wrappers (`evaluations`, `history`, `tasks`, `queue`, and `policies`), camelCase view-model fields, direct evaluation result objects, and direct GC result objects. Missing evaluation, factory change, policy, and GC agent identifiers return JSON 404 responses. Required-field and invalid policy payloads return JSON 422 responses.

## Storage

Migration `V18__agent_operations.sql` adds `agent_evaluations`, `agent_evaluation_runs`, `factory_tasks`, `factory_changes`, `gc_policies`, and `gc_runs`, with indexes and foreign keys for the main lookup paths. Evaluation, evaluation-run, factory-task, and GC-run records are scoped to the authenticated user. The six GC policies named by the frontend are seeded enabled with thresholds from 65% to 85%.

## Synthetic v1 execution

Evaluation runs synchronously derive plausible totals, pass/fail/skip counts, scores, durations, and test details from the stored evaluation plus a varying execution seed. GC runs synchronously derive issue records, fixed counts, and entropy reduction, then persist the results. Both replacement points are marked `// v1: synthetic execution` in the route module. Full cleanup executes every currently enabled GC policy and aggregates the persisted individual results.

## Verification

`nice -n 19 cargo check -p allternit-api` completed successfully. It reported one pre-existing `unused_mut` warning in `cmd/allternit-api/src/agent_routes.rs:604`; the new Agent Operations module compiled without warnings or errors.
