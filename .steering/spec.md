# Steering spec — Discovery-to-spec pipeline, Phase 1: scout (discover → brief → announce)

<!-- SOURCE OF TRUTH for this feature. The steering agent maps every requirement
     to DONE / PARTIAL / MISSING with code evidence at each checkpoint.
     v2: split per spec-review — Phase 1 is the scout only; deterministic
     generator = Phase 2, spec-checker loop + queue = Phase 3. -->

## Context

The repo already has: a functional discovery fetcher (`.github/scripts/lib/pipeline.cjs`:
`fetchAllSources()` over HN/Reddit/arXiv/GitHub Trending/15 RSS feeds — plus social
sources that degrade to `[]` without credentials — returning `.filtered` pre-thresholded
at 0.35 via `scoreRelevance()`), a live rails mail API (port 8013), a memory API
(port 3201), and the steering/checker system. Spec standards (OpenSpec layout,
EARS-ish requirements, Gherkin acceptance) are adopted, not reinvented.

## Prerequisites

- P1: local `allternit-api` runs with `ALLTERNIT_LOCAL_DEV_BYPASS=1` so localhost
  callers pass rails auth (`cmd/allternit-api/src/config.rs:369`).

## Requirements (Phase 1 — scout only)

- [ ] R1: WHEN a scout run executes, THE SYSTEM SHALL call `fetchAllSources()`
  with social sources disabled where option flags allow, iterate
  `result.filtered`, and write a mechanism brief (what it does, how it works
  internally, candidate integration surface in this repo) per item to
  `.pipeline/briefs/<slug>.md` — but only for the top 5 items by relevance
  score among items not already in `.pipeline/seen.json` (dedup filter first,
  then cap).
- [ ] R2: WHEN a scout run starts, THE SYSTEM SHALL load `.pipeline/seen.json`
  (a JSON array of item slugs from prior runs) and skip any item already
  listed; WHEN a brief is written, THE SYSTEM SHALL append its slug and persist
  the file (cross-run idempotency).
- [ ] R3: WHEN a brief is written, THE SYSTEM SHALL announce it to rails thread
  `wih:pipeline-discovery` via `POST /api/rails/mail/share` (thread is
  auto-created by the endpoint).
- [ ] R4: IF rails is unreachable during R3, THE SYSTEM SHALL skip the
  announcement, append the failure to `.pipeline/errors.log`, and continue the
  run (no retry, no abort).

## Cross-cutting constraints

- C1: every pipeline stage SHALL be a prompt+model pair behind a one-file
  interface (the `ao-consult` pattern); formats and rubrics live in the repo as
  data files. (Intent, not checker-verdictable.)
- C2: rails/memory are accessed only through their existing HTTP APIs
  (grep-checkable: no direct DB or client-lib imports).
- C3: `.pipeline/` code and templates are committed; `briefs/`, `specs/`,
  `queue/`, `seen.json`, `errors.log` are gitignored runtime artifacts
  (multi-machine artifact sync is via rails asset refs, not git).

## Out of scope (later phases)

- Phase 2: deterministic brief→spec generator (OpenSpec+EARS+Gherkin, no LLM).
- Phase 3: spec-checker loop (READY/NEEDS-WORK, 3-round cap), `.pipeline/queue/`,
  memory ingestion of rejection patterns (port 3201).
- Executor consumption of the queue, self-improve lineage integration,
  auto-merge, issue-tracker sync.

## Acceptance (Gherkin)

- Scenario: a fresh run produces capped, announced briefs
  Given stubbed sources returning 8 items above threshold
  When the scout runs
  Then exactly 5 briefs exist in `.pipeline/briefs/`, `seen.json` lists all 5
  slugs, and `wih:pipeline-discovery` holds 5 announcements.
- Scenario: a re-run is idempotent
  Given `seen.json` from the previous scenario
  When the scout runs again with the same sources
  Then no new briefs are written and no announcements are made.
- Scenario: rails outage degrades gracefully
  Given rails is unreachable
  When the scout runs
  Then briefs are still written locally and `.pipeline/errors.log` records the
  skipped announcements.
