# PHASE B2 TASK — rails graph robot surface (HTTP + CLI)

You are the executor. `.steering/spec.md` (Phase B2: R1–R2 + Gherkin acceptance)
is the source of truth. B1 is merged: `rails/src/graph/` provides
`compute_insights`/`GraphInsights` over the ticket `DependencyGraph`. Read
`rails/src/graph/mod.rs` and `docs/RAILS_GRAPH_B1_NOTES.md` first — the NOTES
flag that `compute_insights` can block its caller up to 5s on large graphs, so
the HTTP handlers MUST wrap calls in `tokio::task::spawn_blocking`.

## Workflow rules (mandatory)

1. Update `.steering/checkpoint.md` at checkpoints; `[steering]` messages are
   authoritative.
2. Done + verified → `docs/RAILS_GRAPH_B2_NOTES.md` with YAML frontmatter
   (`status`, `files_changed`, `deviations`, `remaining`), then
   `touch docs/RAILS_GRAPH_B2_NOTES.sentinel`.
3. Then commit: `git add rails cmd .steering docs && git commit -m "feat(rails): graph robot surface — HTTP + CLI insights/triage/impact (B2)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. **HTTP** (in `cmd/allternit-api/src/rails/mod.rs`, following the A1 ticket
   handler conventions — `XxxRequest`/response serde structs, Json errors):
   - `GET /api/rails/graph/insights` — health summary + keystones (critical
     path impact), bottlenecks (betweenness), quick wins (ready + low
     downstream impact), phase-2 status flags, graph content hash.
   - `GET /api/rails/graph/triage` — ranked READY tickets (use the A1 shared
     ready function) with score, human-readable reason, and unblocks count;
     bounded: cap list length so a 500-ticket graph's response stays < 16KB.
   - `GET /api/rails/graph/impact/:ticket_id` — what closing/blocking this
     ticket affects: direct + transitive dependents, its critical-path impact
     value, its centrality ranks. 404 for unknown ticket ids.
   - All three: `tokio::task::spawn_blocking` around compute; response
     includes the per-metric status tags (Computed/Approx/Timeout/Skipped)
     and the graph content hash from B1's cache.
2. **CLI** (`rails/src/bin/allternit-rails.rs`): new `rails graph` command
   group with `insights`, `triage`, `impact <ticket_id>` subcommands printing
   the same JSON as the HTTP responses (shared serialization code, not two
   implementations — put the view-model builders in the rails crate, e.g.
   `rails/src/graph/views.rs`, used by both surfaces).
3. **Tests**: view-model unit tests over the diamond fixture (keystone =
   A, D most blocked, quick-win logic sane); triage bounding test (synthetic
   large graph → serialized body < 16KB); impact on unknown id → error.
   HTTP handler tests only if the crate has a precedent for them — otherwise
   cover via view-model tests and a smoke note in NOTES.

## Constraints

- `cargo test -p allternit-agent-system-rails` passes;
  `cargo build -p allternit-api` compiles (record both in NOTES).
- No new external crates without a NOTES justification.
- Do not modify `rails/src/work/` (different graph system, out of scope).
