---
status: done
files_changed:
  - rails/src/graph/mod.rs
  - rails/src/graph/algorithms.rs
  - rails/src/graph/tests.rs
  - rails/src/lib.rs
deviations:
  - "Off-thread phase 2 uses std::thread::spawn + mpsc::recv_timeout, not tokio::task::spawn_blocking: B1 is a synchronous library with no tokio runtime context (spec's 'where relevant' qualifier). B2 NOTE: compute_insights can block its caller for up to 5s on a large graph, so B2's async HTTP handler must wrap the entire call in tokio::task::spawn_blocking."
  - "Timeout results are NOT cached: a cached Timeout would poison the content hash forever, so a later call with a viable budget recomputes."
  - "Large-graph size check and timeout use the blocking-subgraph edge count (GraphView::edge_count) for both, not graph.edges().count() over all edge kinds — blocking edges are what phase-2 cost scales with (flagged in steering review, made consistent)."
  - "Critical path is tagged Skipped on cyclic graphs (longest path is ill-defined); PageRank/HITS/betweenness/cycles still compute on cyclic input."
remaining:
  - "Phase B2: HTTP + CLI surface (/api/rails/graph/insights, /triage, /impact/:id) consuming GraphAnalytics — not started, out of B1 scope."
---

# Phase B1 — rails graph analytics library: completion notes

## What was built

New module `rails/src/graph/` over the ticket dependency graph
(`rails/src/dependencies.rs` `DependencyGraph`, `DependencyKind::Blocks`
subgraph only). `rails/src/work/graph.rs` is the unrelated work/DAG system
and was not touched — both `mod.rs` and `algorithms.rs` open with that
warning.

- **Phase 1 (instant):** node/edge counts, in/out degree, density,
  Kahn topological order (`None` on cycles). Always tagged Computed.
- **Phase 2 (heavy):** PageRank (damping 0.85, epsilon convergence,
  dangling-node redistribution), betweenness via Brandes' algorithm, HITS
  (hubs/authorities, L2-normalized), critical path (longest blocking chain;
  per-node impact = 1 + max downstream impact), elementary cycle
  enumeration (canonicalized to min-index start, capped at
  `max_cycles = 1000`, tagged Approx when capped). All pure Rust, no new
  crates.
- **`GraphInsights`:** blake3 content hash of the sorted edge set (all
  kinds), phase-1 facts, phase-2 metrics each tagged
  `Computed | Approx | Timeout | Skipped`, `computed_at`.
- **`GraphAnalytics::compute_insights(graph, config)`:** phase 2 runs
  inline (still Computed) when nodes ≤ 200 and blocking edges ≤ 1000;
  above that it runs on a spawned thread bounded by
  `min(500ms + 1ms/blocking-edge, 5s)` (override via
  `config.timeout_override`), tagging all phase-2 metrics Timeout on
  expiry. Results cached in `Mutex<HashMap<hash, Arc<GraphInsights>>>`.

## Verification

`cargo test -p allternit-agent-system-rails` — **passes**:
61 lib tests (incl. 5 new `graph::tests`), 5 `tests/invariants.rs`,
1 doc-test; 0 failed.

Fixture tests (`rails/src/graph/tests.rs`, spec B1-R3 + Gherkin):

- diamond (A blocks B,C; B,C block D): A top keystone (impact 3 > B=C=2 >
  D=1), D most blocked (in-degree 2), B and C tie in betweenness, all
  metrics Computed.
- chain: topo order A→B→C→D, longest chain matches, impact 4..1.
- cycle A→B→C→A: cycle enumerated once ({A,B,C}), topo `None`, critical
  path Skipped, flow metrics Computed.
- 250-node synthetic graph + forced zero timeout: all phase-2 metrics
  Timeout, phase-1 facts Computed, timeout result not cached.
- cache: second same-graph call serves the same `Arc`,
  `computation_count` stays 1.

Steering review applied: one E0308 compile fix (pattern in critical-path
chain reconstruction) and the size-check consistency fix above.
