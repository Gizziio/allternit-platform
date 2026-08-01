# Track B spec — rails graph engineering for the agentic layer

Status: DRAFT v2 (steered; split per review). B1 activates when A1 merges to
main. Source of truth for WHAT when each phase activates.

## Context

A1 gives rails an event-sourced TICKET dependency graph (`dependencies.rs`
`DependencyGraph`, `tickets::ready`/`blocked`). Track B turns that graph into
an agent-facing capability: precomputed, trust-annotated graph intelligence
agents consume instead of raw traversal (bv sidecar pattern, baked into rails,
no beads naming).

BUILDER TRAP WARNING (from steering review): `rails/src/work/graph.rs` is a
DIFFERENT graph system (work/DAG nodes) with similar-sounding functions
(`ready_nodes`, `would_create_cycle`). All Track B analytics operate on the
TICKET dependency graph (`rails/src/dependencies.rs`) only. The new module
must open with a comment stating which graph it operates on and naming
`work/graph.rs` as the unrelated system not to touch. Do not modify the
work/DAG/WIH system anywhere in Track B.

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

## Phase B2 — robot surface (after B1)

- [ ] B2-R1: WHEN an agent calls HTTP, THE SYSTEM SHALL serve fixed-shape JSON
  under `/api/rails/graph/`: `GET /insights` (health + keystones + bottlenecks
  + quick wins), `GET /triage` (ranked ready work with scores, reasons,
  unblock counts), `GET /impact/:ticket_id` — each carrying phase-2 status
  flags and the graph content hash, each bounded < 16KB at 500 tickets.
- [ ] B2-R2: WHEN CLI is preferred, THE SYSTEM SHALL expose the same three
  views as `rails graph` subcommands printing the identical JSON.

## Phase B3 — pipeline integration (after B2, needs "ticket-backed" defined)

BLOCKED ON A DESIGN DECISION (not for the builder): how a pipeline spec/queue
item links to a rails ticket — a `ticket:` field in the generator's spec
frontmatter, a manual CLI tag, or tickets as the queue's native store. Decide
before scoping B3.

- [ ] B3-R1: WHEN the queue is ticket-backed, check-spec consult requests
  include the `/insights` summary.
- [ ] B3-R2: WHEN build-queue `--all` runs over ticket-backed items, builds
  order by triage score (unblocks count first).
- [ ] B3-R3: B3 wiring fails open: if the graph surface is unreachable,
  check-spec and build-queue behave exactly as before.

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
