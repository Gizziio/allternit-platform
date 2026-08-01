---
status: done
files_changed:
  - rails/src/graph/views.rs
  - rails/src/graph/fixtures.rs
  - rails/src/graph/view_tests.rs
  - rails/src/graph/mod.rs
  - rails/src/graph/algorithms.rs
  - rails/src/graph/tests.rs
  - rails/src/bin/allternit-rails.rs
  - cmd/allternit-api/src/rails/mod.rs
deviations:
  - "Shared GraphAnalytics lives in RailsState (`Arc<GraphAnalytics>` field, initialized in RailsState::new) rather than a OnceLock static: RailsState is only ever built via ::new (verified by grep), so a field keeps the content-hash cache per-process with no new crates and no global state."
  - "HTTP handler tests WERE added (task allowed skipping if no precedent): cmd/allternit-api has a handler-test precedent (office_cli_routes.rs builds a full AppState + oneshot), so rails/mod.rs got one tokio test seeding the diamond via TicketStore + dependencies::add_edge and asserting insights/triage/impact incl. 404 (unknown id) and 400 (malformed id)."
  - "Triage score is a deterministic u64 (unblocks x 10 + critical-path impact + priority boost 4-level), not a float: all components are integral, so CLI/HTTP parity is exact and ranking is stable with id tiebreak."
  - "CLI smoke test could not run in this environment: the CLI's eager startup (Leases/Index SQLite init in main, shared by ALL subcommands including the pre-existing `ticket ready`) fails with SQLITE_CANTOPEN on both this repo root and fresh temp dirs. Pre-existing, unrelated to B2; the graph subcommands sit behind the identical startup path as `ticket ready` and use the same builders, and the HTTP handler test covers the full store -> graph -> view pipeline against a real seeded store."
remaining:
  - "CLI end-to-end smoke (`rails graph insights|triage|impact` against a live workspace) once the pre-existing CLI SQLite startup issue is resolved."
  - "Migrate existing modules to the shared template shell etc. — unrelated backlog, untouched."
---

# Phase B2 — rails graph robot surface (HTTP + CLI): completion notes

## What was built

- **`rails/src/graph/views.rs`** — shared, pure view-model builders used by
  BOTH surfaces (one implementation, CLI/HTTP JSON parity by construction):
  - `build_insights_view` — health summary (counts, density, cyclic flag,
    cycle count, longest-chain length, most-blocked ticket, ready count),
    keystones (top 10 by critical-path impact), bottlenecks (top 10 by
    Brandes betweenness, zero scores filtered), quick wins (ready tickets
    with downstream impact <= 1, priority-sorted, capped at 10).
  - `build_triage_view` — ready tickets ranked by `unblocks*10 + impact +
    priority boost`, each with a human-readable reason and transitive
    unblock count (BFS over `GraphView::adj`). Capped at
    `MAX_TRIAGE_ITEMS = 50`, titles truncated to 64 chars: a 500-ticket
    worst case serializes to ~9KB (< 16KB bound, test-enforced).
  - `build_impact_view` — direct + transitive dependents, critical-path
    impact, 1-based PageRank/betweenness ranks; typed
    `ViewError::UnknownTicket` when the id is in neither the ticket store
    nor the graph (edgeless-but-known tickets return empty impact).
  - Every view carries `metric_statuses` (per-metric
    Computed/Approx/Timeout/Skipped) and the graph `content_hash`.
- **HTTP** (`cmd/allternit-api/src/rails/mod.rs`): `GET
  /api/rails/graph/insights|triage|impact/:ticket_id` registered in
  `rails_router()`. All load/ready/compute/build work runs inside
  `tokio::task::spawn_blocking` (B1's 5s blocking warning) via a shared
  `run_graph_view` helper; `Arc<GraphAnalytics>` added to `RailsState` so
  the content-hash cache survives across requests. Unknown id -> 404,
  malformed id -> 400, both via the existing `ticket_error` /
  `parse_ticket_id` patterns.
- **CLI** (`rails/src/bin/allternit-rails.rs`): `rails graph insights` /
  `triage` / `impact <ticket_id>` (clap subcommand group, matching existing
  conventions) printing the same view structs via
  `serde_json::to_string_pretty`.
- **Supporting changes:** `GraphView::index_of` accessor in
  `algorithms.rs`; test fixtures (`diamond`, `chain`, `id`, `blocks`, plus a
  `ticket` builder) extracted to `rails/src/graph/fixtures.rs` and reused by
  both `tests.rs` and the new `view_tests.rs`.

## Verification

- `cargo test -p allternit-agent-system-rails` — **passes**: 67 lib tests
  (61 B1 + 6 new `graph::view_tests`), 5 `tests/invariants.rs`, 1 doc-test;
  0 failed.
  - diamond: A top keystone (impact 3), D most blocked, all metrics
    Computed; A (impact 3) excluded from quick wins, isolated ready ticket
    included.
  - triage: A scores 35 (3 unblocks x 10 + 3 impact + 2 P2 boost), reason
    string asserted; 500-ticket worst case body < 16KB, capped at 50 items.
  - impact: direct [B,C] / transitive [B,C,D] for A, ranks asserted,
    edgeless-known ticket returns empty impact, unknown id -> typed error.
- `cargo build -p allternit-api` — **compiles** (4 pre-existing warnings in
  unrelated files, none from this change).
- `cargo test -p allternit-api --lib rails::tests` — **passes**: 1 test
  (`graph_endpoints_over_diamond_fixture`) covering all three endpoints over
  a real seeded store, incl. 404/400 paths.
