# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase A1 rails ticket parity (`.steering/spec.md`, R1–R5): event-sourced
dependency edges, event-only ticket state rebuild, one shared ready function,
HTTP ticket surface under `/api/rails/tickets`, and 409 cycle rejection.
Requirements are enumerated in `.steering/spec.md`.

## Just did

Implemented R1–R5 (code complete, tests running):

- R1: `DependencyAdded`/`DependencyRemoved` events on `TicketEvent` (filed
  under `from`; `all_events()` now pub). Shared `GRAPH_PATH`/`load_graph`/
  `save_graph`/`rebuild_graph_from_events`/`add_edge`/`remove_edge` in
  `dependencies.rs`; `load_graph` falls back to full-log replay when
  `graph.json` is missing; add/remove re-derive the snapshot from the log.
  batch.rs, doctor.rs, mcp.rs converted to the shared functions (three
  private copies gone). BatchExecutor appends dependency events on apply.
- R2: `LabelAdded`/`LabelRemoved` events + `add_label`/`remove_label` ops;
  `get()` no-snapshot fallback does full replay via a shared `apply_event`
  helper (also used by `rebuild_snapshots`, whose `Updated` no-op is fixed).
- R3: shared `tickets::ready` / `tickets::blocked` (+ `BlockedTicket`) in
  tickets/mod.rs; MCP `tool_ready` rewired; NEW `rails ticket ready` CLI
  subcommand added (DAG `ready` untouched).
- R4: HTTP routes under `/api/rails/tickets` in cmd/allternit-api/src/rails/
  mod.rs: create, list (status/label query), get, patch update, close,
  reopen, add/remove dependency, ready, blocked. `RailsState` gained
  `root_dir`. XxxRequest/XxxResponse structs + Json errors, matching file
  conventions.
- R5: add-dependency validates before applying (404 unknown endpoints; 409 +
  `cycle` path array via would_cycle/find_cycle; nothing persisted on
  rejection).
- `cargo check -p allternit-agent-system-rails` clean. Added unit tests:
  dependency event round-trip + full-log rebuild + ready exclusion, remove
  round-trip, cycle rejection without persistence (dependencies.rs); label
  events, event-only get() rebuild, ready incl. wait-gate exclusion + blocked
  list (tickets/mod.rs).

Deviation: templates.rs (not in the task's module list) still mutates its
caller-owned in-memory graph without events; documented in NOTES.

## Just did

Addressed the steering commit-gate block:

- MAJOR (batch rollback contradicting the event log): `BatchExecutor` no
  longer restores the pre-batch `graph.json` on save failure — it deletes
  the snapshot so the next `load_graph` rebuilds from the authoritative
  event log. Module + `execute` docs updated to match.
- MINOR (unused imports): dropped `delete`/`patch` from the axum routing
  import in cmd/allternit-api/src/rails/mod.rs (routes use method-chained
  `.delete()`/`.patch()`).
- Re-verified: `cargo test -p allternit-agent-system-rails --lib` 56/56
  pass; `cargo check -p allternit-api` clean.
- NOTES updated with the gate-fix deviation; sentinel touched.

## Next

Retry the mandated commit: `git add rails cmd .steering docs && git commit
-m "feat(rails): ticket parity A1 — dependency events, shared ready, HTTP
tickets"`.

## Open questions

- (none)
