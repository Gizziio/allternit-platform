# Steering spec — rails ticket parity, Phase A1

<!-- SOURCE OF TRUTH for this feature (Track A1 of .pipeline/PROGRAM-rails-parity.md).
     The steering agent maps every requirement to DONE / PARTIAL / MISSING. -->

## Context

The rails crate (`rails/src/`) already has the ticket subsystem (the crate's own
docs call a ticket "the Rails equivalent of a Beads issue"): `tickets/mod.rs`
(event-sourced ticket store, hash-chained events, snapshots), `dependencies.rs`
(typed dep graph with cycle detection), `wait_gates.rs` (temporal gates, never
wired in), `batch.rs` (atomic multi-op), `rails_id.rs` (blake3 `T-<hex>` ids).
Missing: dependency mutations emit no events and persist as one monolithic
`graph.json`; ready-vs-blocked logic is duplicated inline in MCP `tool_ready`
with no library function and no wait-gate consultation; tickets have no HTTP
endpoints at all; `TicketStore::get` cannot rebuild state from events alone.

## Requirements

- [ ] R1: WHEN a dependency edge is added or removed, THE SYSTEM SHALL append a
  hash-chained `DependencyAdded`/`DependencyRemoved` event to the ticket event
  log, and the dependency graph SHALL be derivable by replaying those events
  (the monolithic `graph.json` may remain only as a rebuildable snapshot).
  Note for the builder: dependency events span two tickets, but the event
  filing convention is single-ticket-keyed (`events_for(id)`) — graph rebuild
  MUST use a full-log scan (e.g. `all_events()`), not the per-ticket path.
  R1 also REQUIRES consolidating the three private `load_graph`/`save_graph`
  implementations (batch.rs, doctor.rs, mcp.rs) into one shared function all
  callers use.
- [ ] R2: WHEN labels are added to or removed from a ticket, THE SYSTEM SHALL
  append `LabelAdded`/`LabelRemoved` events, and `TicketStore::get` SHALL
  reconstruct full ticket state (status, labels, notes) from the event log
  alone when no snapshot exists.
- [ ] R3: WHEN anything asks which tickets are ready, THE SYSTEM SHALL compute
  it via one shared library function (open, not deferred, every incoming
  `blocks` edge closed, and no unsatisfied wait-gate from
  `WaitGateStore::blocking_for` returned for that ticket). The MCP
  `tool_ready` handler SHALL call it, and THE SYSTEM SHALL add a NEW ticket
  CLI subcommand (`rails ticket ready` — it does not exist today; the CLI
  `ready` command in cli/work.rs belongs to the out-of-scope work/DAG system
  and MUST NOT be touched) that also calls it.
- [ ] R4: WHEN a caller uses HTTP, THE SYSTEM SHALL expose ticket operations
  under `/api/rails/tickets`: create, list (with query filter), get, update,
  close, reopen, add/remove dependency, ready list, and blocked list (ticket
  plus the ids blocking it), following the existing axum handler conventions in
  `cmd/allternit-api/src/rails/mod.rs`.
- [ ] R5: WHEN the HTTP dependency endpoints are called with an edge that would
  create a cycle, THE SYSTEM SHALL reject with 409 and the cycle path, and no
  partial mutation SHALL be persisted (precedent to reuse:
  `DependencyGraph::would_cycle`/`find_cycle` plus `BatchExecutor`'s
  validate-before-apply with graph snapshot restore, batch.rs:72-77/201).

Note: if this phase proves too large for one session, split at the R3/R4
boundary (event-sourcing core first, HTTP surface second) — never
mid-requirement.

## Out of scope

- JSONL interchange (A2), capacity/admission policies (A3), graph analytics
  (Track B), any changes to the work/DAG/WIH system.

## Acceptance (Gherkin)

- Scenario: dependency events rebuild the graph
  Given two tickets with a blocks edge added via the new event path
  When the graph.json snapshot is deleted and the graph is rebuilt from events
  Then the edge is present and the blocked ticket is not in the ready list.
- Scenario: wait-gates block readiness
  Given a ticket with an unsatisfied Timer wait-gate
  When the ready list is computed via the shared function
  Then the ticket is absent until the gate resolves.
- Scenario: HTTP ready and cycle rejection
  Given tickets created over HTTP with a dependency
  When GET /api/rails/tickets/ready is called
  Then only unblocked tickets are returned; and adding a cycling edge returns
  409 with the cycle path and the prior edges intact.
- Scenario: event-only state rebuild
  Given a ticket that received status changes, label changes, and notes
  When its snapshot file is removed and get() is called
  Then all state matches the event history.

## Constraints

- `cargo test -p allternit-agent-system-rails` MUST pass (this phase requires
  build+test, unlike the JS pipeline phases).
- Match crate conventions: serde-tagged snake_case events, `XxxRequest`/
  `XxxResponse` HTTP structs, Json error bodies with StatusCode.
- No new external crates without a steering note justifying them.
