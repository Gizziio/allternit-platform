# PHASE B1 TASK — rails graph analytics library

You are the executor. `.steering/spec.md` (Phase B1: R1–R3 + Gherkin acceptance)
is the source of truth for WHAT — read it first. Also read the builder-trap
warning in `docs/pipeline/TRACK-B-rails-graph.md` (top of file): the analytics
operate on the TICKET dependency graph (`rails/src/dependencies.rs`,
`DependencyGraph`), NOT `rails/src/work/graph.rs` (a different, out-of-scope
system with deceptively similar function names).

## Workflow rules (mandatory)

1. Update `.steering/checkpoint.md` at checkpoints; `[steering]` messages are
   authoritative — fix, answer, update the checkpoint.
2. Done + verified → `docs/RAILS_GRAPH_B1_NOTES.md` with YAML frontmatter
   (`status`, `files_changed`, `deviations`, `remaining`), then
   `touch docs/RAILS_GRAPH_B1_NOTES.sentinel`.
3. Then commit: `git add rails .steering docs && git commit -m "feat(rails): graph analytics library — PageRank/HITS/betweenness/critical-path (B1)"`.
   A gate reviews; fix and retry if blocked.

## Build

New module `rails/src/graph/` (mod.rs + algorithm files as you see fit),
registered in `rails/src/lib.rs`:

1. Top-of-module comment: which graph this operates on (ticket
   `DependencyGraph`) and that `rails/src/work/graph.rs` is the unrelated
   system not to touch.
2. Phase 1 (instant): degree stats, topological order, density over a
   `&DependencyGraph`.
3. Phase 2 (heavy): PageRank (damping 0.85, iterate to epsilon), betweenness
   (Brandes' algorithm), HITS (hubs vs authorities), critical path (longest
   blocking chain; per-node impact = 1 + max downstream impact), cycle
   enumeration. All pure Rust, no new crates.
4. `GraphInsights` struct: content hash of the graph (hash the sorted edge
   set), phase-1 facts, phase-2 metrics, per-metric status tag
   (`Computed | Approx | Timeout | Skipped`), computed_at.
5. `compute_insights(graph, config)`: two-phase orchestration per spec R2 —
   phase 2 only when nodes > 200 or edges > 1000 (below that, phase 2 runs
   inline and is still tagged Computed); timeout = min(500ms + 1ms/edge, 5s);
   results cached in a `DashMap`-free simple cache (std Mutex<HashMap<hash,
   Arc<GraphInsights>>> is fine — no new crates) keyed by content hash.
6. Tests (in-module or tests/): diamond fixture (A blocks B,C; B,C block D) —
   assert A is top keystone by critical-path impact, D most blocked, B and C
   tie in betweenness; chain fixture ordering; cycle fixture enumerates the
   cycle; forced-tiny-timeout on a synthetic >200-node graph yields Timeout
   on phase-2 metrics while phase-1 stays Computed; same-hash second call
   serves from cache (assert via a computation counter or elapsed-time guard).

## Verification (required)

- `cargo test -p allternit-agent-system-rails` passes (recorded in NOTES).
- No HTTP/CLI work — that is Phase B2. Library only.
- No new external crates (spec constraint).
