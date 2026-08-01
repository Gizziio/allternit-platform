# Steering checkpoint

## Goal

Phase B1 (spec.md B1-R1..R3): graph analytics library over the TICKET
dependency graph (`rails/src/dependencies.rs` `DependencyGraph`, blocking
subgraph) in a new module `rails/src/graph/` — PageRank, Brandes betweenness,
HITS, critical path (impact = 1 + max downstream), cycle enumeration, topo
order; two-phase orchestration with size-aware timeout and content-hash cache;
per-metric status tags. Library only, no new crates. Builder trap:
`rails/src/work/graph.rs` is unrelated and untouched.

## Just did

Implemented `rails/src/graph/{mod.rs,algorithms.rs,tests.rs}` + `pub mod
graph;` in lib.rs. Applied steering review: fixed E0308 pattern bug in
critical-path chain reconstruction (`Some((start, _))`), and made the
large-graph size check consistent (blocking-edge count for both the
threshold and the timeout). `cargo test -p allternit-agent-system-rails`
passes: 61 lib tests (5 new graph tests: diamond/chain/cycle/forced-
timeout/cache), 5 invariant tests, 1 doc-test — 0 failures.

## Next

Write `docs/RAILS_GRAPH_B1_NOTES.md` (+ sentinel) recording verification
and deviations, then commit `rails .steering docs` with the task-file
message. Gate review expected.

## Open questions

- (none)
