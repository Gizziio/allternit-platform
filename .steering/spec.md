# Steering spec — rails graph, Phase B1 (analytics library)

<!-- From .pipeline/TRACK-B-rails-graph.md (steered v2). Source of truth for this feature. -->

## Phase B1 — analytics library (activates after A1 merges)

- [ ] B1-R1: WHEN graph analytics are requested, THE SYSTEM SHALL compute over
  the ticket dependency graph in a new module `rails/src/graph/`: PageRank
  (load-bearing tickets), betweenness centrality (chokepoints), HITS (hub
  epics vs authority utilities), critical path (longest blocking chain,
  per-node impact = 1 + max downstream impact), cycle enumeration, and
  topological order.
- [ ] B1-R2: WHEN analytics are computed, THE SYSTEM SHALL run two phases:
  phase 1 instant static facts (degree, topo, density); phase 2 heavy metrics
  (PageRank, betweenness, HITS) computed off the request thread
  (`tokio::task::spawn_blocking` where relevant) with a size-aware timeout —
  phase 2 triggers when nodes > 200 or edges > 1000, timeout = min(500ms +
  1ms/edge, 5s) — cache results keyed by a content hash of the graph, and tag
  every metric `computed | approx | timeout | skipped`.
- [ ] B1-R3: WHEN `cargo test -p allternit-agent-system-rails` runs, THE
  SYSTEM SHALL pass analytics correctness tests on known fixtures: diamond
  (A blocks B,C; B,C block D), chain, and a cycle — asserting keystone,
  chokepoint, and impact rankings by construction.


## Acceptance (Gherkin) — B1

- Scenario: keystones are found, not guessed
  Given the diamond fixture graph
  When analytics are computed
  Then A ranks as top keystone by critical-path impact and D the most
  blocked, all metrics tagged "computed".
- Scenario: cache and status flags
  Given insights computed for graph hash H
  When the same graph is queried again
  Then results serve from cache with the same hash; and with a forced tiny
  timeout on a >200-node graph, phase-2 metrics report "timeout" while
  phase-1 facts report "computed".


## Constraints

- No new external crates (PageRank/HITS/betweenness implemented in-crate;
  betweenness via Brandes' algorithm, expect ~80-100 lines with edge cases).
- `cargo test -p allternit-agent-system-rails` passes.
