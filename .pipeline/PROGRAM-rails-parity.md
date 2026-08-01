# Program: rails task parity, graph viewer, taste engine, brain onboarding

Four tracks, sequenced. Each phase gets its own `.steering/spec.md` when active.
Source analysis: rails crate recon (tickets/mod.rs, dependencies.rs, wait_gates.rs,
batch.rs, mcp.rs, cmd/allternit-api/src/rails/mod.rs) + Dicklesworthstone
ecosystem research (beads_rust/beads_viewer, cass/meta_skill/agent_mail/ubs/dcg).

## Track A — rails ticket parity (close the beads gap)

- A1 (FIRST): dependency events + shared ready computation + HTTP surface.
  Gaps closed: dep mutations bypass event log; monolithic graph.json loaded/saved
  by THREE private duplicate implementations (batch.rs, doctor.rs, mcp.rs) as
  source of truth; the only ticket-ready computation is inline in MCP
  tool_ready with no shared function; wait-gates unwired; zero ticket HTTP
  endpoints; get() can't rebuild from events.
- A2: JSONL interchange (tickets.jsonl/dependencies.jsonl export-import, dedup,
  conflict policy) for git-based collaboration.
- A3: capacity/admission policies (limits per status, required fields per
  transition, in-transaction enforcement — br policy.yaml model).

## Track B — rails graph viewer ("rails graph", no beads naming)

- B1: analytics over the typed dependency graph: PageRank, betweenness, HITS,
  critical path, cycles, topo. Two-phase (instant static facts / async metrics),
  data_hash caching, per-metric status flags. Library + robot JSON HTTP
  endpoints under /api/rails/graph/*.
- B2: viewer surface (CLI first: `rails graph` subcommands with robot JSON;
  app surface later).

## Track C — taste engine (pipeline learns the project)

- C1: taste corpus — connectors ingesting repo docs/code, allternit-brain wiki,
  and local agent session logs into the memory service with trust tiers
  (merged=trusted, failed/reverted=excluded).
- C2: wiki connector — enforcement-only trust (wiki adds candidates, never
  permissions), frontmatter convention, gap mining, dismissal feedback w/ TTL.
- C3: artifact contracts — schema_version + provenance_refs + trust_tier on
  pipeline artifacts, golden-pinned.
- C4: outcome feedback edges — merge/reject written back on producing artifacts,
  decay, PITFALL precedents.

## Track D — second-brain onboarding (product)

- D1: gizzi-code: `gizzi brain init` — creates a user's second-brain repo
  (allternit-brain structure), wires memory ingestion.
- D2: platform: brain creation flow (API + surface).
- D3: iOS: onboarding step that starts the user's brain.
