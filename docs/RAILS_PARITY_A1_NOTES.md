---
status: verified
files_changed:
  - rails/src/tickets/mod.rs
  - rails/src/dependencies.rs
  - rails/src/batch.rs
  - rails/src/doctor.rs
  - rails/src/mcp.rs
  - rails/src/bin/allternit-rails.rs
  - cmd/allternit-api/src/rails/mod.rs
deviations:
  - templates.rs was left unchanged (not in the task's module list; it mutates
    a caller-owned in-memory DependencyGraph and never persisted graph.json
    itself). Template-instantiated edges therefore still emit no dependency
    events; all persisted-edge paths (shared add_edge/remove_edge, batch,
    HTTP) do emit them.
  - Pre-existing bug fixed in passing: TicketStore::events_for matched event
    filenames with starts_with(id), but files are named
    `{sequence:08}-{id}-{ts}.json`, so it never matched. The old no-op get()
    fallback hid this. Now matches on the `-{id}-` middle segment.
  - Steering-gate fix: BatchExecutor's save-failure path no longer restores
    the pre-batch graph.json (that snapshot would contradict dependency
    events already appended to the log). It deletes the snapshot instead, so
    the next load_graph rebuilds from the authoritative event log.
  - rails ticket ready prints the ready tickets as pretty JSON (the CLI had no
    prior ticket surface to mirror; matches PlanCmd::Show's JSON style).
  - HTTP DELETE /tickets/:id/dependencies takes a JSON body ({to, kind}) —
    simplest way to carry the edge spec; axum supports it.
remaining:
  - graph.json written by pre-A1 workspaces has no matching dependency events;
    load_graph still prefers it when present, so legacy edges keep working,
    but they are not in the event log (one-way migration not in scope).
---

# PHASE A1 NOTES — rails ticket parity

## What was built

- **R1 (dependency events):** `TicketEvent::DependencyAdded` /
  `DependencyRemoved` (serde-tagged snake_case, hash-chained envelopes, filed
  under the `from` ticket id). Shared graph functions in
  `rails/src/dependencies.rs`: `GRAPH_PATH`, `load_graph`, `save_graph`,
  `rebuild_graph_from_events` (full-log scan via now-public
  `TicketStore::all_events()`), `add_edge`, `remove_edge`. `graph.json` is a
  rebuildable snapshot: `load_graph` replays the log when it is missing, and
  add/remove re-derive it from the log after appending. The three private
  `load_graph`/`save_graph` copies (batch.rs, doctor.rs, mcp.rs) are
  consolidated into these; `BatchExecutor` also appends `DependencyAdded`
  events on apply (keeping its validate-before-apply + snapshot-restore
  precedent).
- **R2 (event-only state):** `LabelAdded` / `LabelRemoved` events with
  `TicketStore::add_label` / `remove_label` ops. `TicketStore::get`'s
  no-snapshot fallback now fully replays the log via one shared `apply_event`
  helper (status, labels, notes, all `Updated` fields), which
  `rebuild_snapshots` also uses.
- **R3 (shared ready):** `tickets::ready` / `tickets::blocked` (+ public
  `BlockedTicket`) in `rails/src/tickets/mod.rs`: open, not deferred, every
  incoming `blocks` edge closed, no unsatisfied gate from
  `WaitGateStore::blocking_for`. MCP `tool_ready` calls it; new CLI
  subcommand `rails ticket ready` calls it (the DAG system's `ready` in
  cli/work.rs untouched).
- **R4 (HTTP surface):** in `cmd/allternit-api/src/rails/mod.rs` —
  `POST/GET /api/rails/tickets` (list filters: `status`, `label` query),
  `GET/PATCH /tickets/:id`, `POST /tickets/:id/close`, `POST
  /tickets/:id/reopen`, `POST/DELETE /tickets/:id/dependencies`,
  `GET /tickets/ready`, `GET /tickets/blocked` (ticket + blocking ids).
  XxxRequest/XxxResponse serde structs, Json error bodies with StatusCode,
  per existing conventions. `RailsState` gained `root_dir` so handlers open
  `TicketStore` per request.
- **R5 (cycle rejection):** HTTP add-dependency validates before applying:
  404 for unknown endpoints; for blocking edges it checks
  `DependencyGraph::would_cycle` and rejects with **409** and
  `{ "error", "cycle": [ids...] }` from `find_cycle` — nothing is persisted
  on rejection (no event, graph untouched). `dependencies::add_edge`
  re-validates defensively.

## Verification (exact commands + outputs)

- `cargo test -p allternit-agent-system-rails` — **56 passed; 0 failed**
  (plus 1 doc-test passed). New tests:
  - dependencies.rs: `add_edge_emits_event_and_graph_rebuilds_from_full_log`
    (deletes graph.json, rebuilds, checks ready exclusion),
    `remove_edge_emits_event_and_rebuild_drops_edge`,
    `add_edge_rejects_cycle_without_persisting` (event count unchanged,
    prior edge intact).
  - tickets/mod.rs: `label_ops_emit_events`,
    `get_rebuilds_state_from_events_without_snapshot` (status + labels +
    notes + updated fields all match event history),
    `ready_excludes_blocked_and_gated_tickets` (wait-gate exclusion, blocked
    list carries blocker ids, closing blocker unblocks).
- `cargo build -p allternit-api` — **compiles** (`Finished dev profile in
  1m 41s`; the only warnings are pre-existing ones in untouched files:
  vm_session_routes.rs, auth.rs).
- CLI smoke note: `allternit-rails ticket ready` compiles into the binary,
  but on this machine the CLI aborts in startup with a sqlx
  `unable to open database file` error from `Index::new` — the pre-existing
  `ledger tail` subcommand fails identically, so this is a pre-existing
  environment issue in untouched startup code, not a regression from A1.
  The ready logic itself is covered by the unit tests above.

## Constraints

- No new external crates.
- Conventions matched: serde-tagged snake_case events, hash-chained
  envelopes, storage roots under `.allternit/rails/`, XxxRequest/XxxResponse
  HTTP structs, Json error bodies with StatusCode.
- No changes to the work/DAG/WIH system (`work/`, `wih/`, `cli/work.rs`,
  routes_cowork.rs untouched).
