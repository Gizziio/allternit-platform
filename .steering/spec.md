# Steering spec — rails graph, Phase B2 (robot surface)

<!-- From .pipeline/TRACK-B-rails-graph.md (steered v2). B1 (analytics library)
     is merged in main: rails/src/graph/. Source of truth for this feature. -->

## Acceptance (Gherkin) — B2

- Scenario: keystones over HTTP
  Given a diamond dependency graph (A blocks B and C; B and C block D) loaded via tickets
  When GET /api/rails/graph/insights is called
  Then A ranks as top keystone by critical-path impact, D the most blocked, all metrics "computed".
- Scenario: bounded triage
  Given a 500-ticket graph
  When GET /api/rails/graph/triage is called
  Then the response body stays under 16KB with ranked recommendations + per-item reasons.
- Scenario: CLI parity
  Given the same graph
  When `rails graph insights` runs
  Then its JSON equals the HTTP /insights response for the same graph hash.

## Phase B2 — robot surface (after B1)

- [ ] B2-R1: WHEN an agent calls HTTP, THE SYSTEM SHALL serve fixed-shape JSON
  under `/api/rails/graph/`: `GET /insights` (health + keystones + bottlenecks
  + quick wins), `GET /triage` (ranked ready work with scores, reasons,
  unblock counts), `GET /impact/:ticket_id` — each carrying phase-2 status
  flags and the graph content hash, each bounded < 16KB at 500 tickets.
- [ ] B2-R2: WHEN CLI is preferred, THE SYSTEM SHALL expose the same three
  views as `rails graph` subcommands printing the identical JSON.


## Constraints

- No new external crates (PageRank/HITS/betweenness implemented in-crate;
  betweenness via Brandes' algorithm, expect ~80-100 lines with edge cases).
- `cargo test -p allternit-agent-system-rails` passes.
