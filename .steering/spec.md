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

- P1: rails must be reachable AND writable before any pipeline work. The repo
  ships `.pipeline/bin/rails-ensure.sh` (R0 below); the packaged-app instance
  of allternit-api does NOT accept pipeline writes (no dev bypass), so the
  dev instance from `dev/scripts/start-api.sh` is the supported rails backend
  (requires the debug binary at `target/debug/allternit-api` — build it with
  `cargo build --bin allternit-api` if missing).

## Requirements (Phase 1 — scout only)

- [ ] R0: `.pipeline/bin/rails-ensure.sh` — WHEN invoked, THE SYSTEM SHALL
  verify rails works by (a) GET `localhost:8013/health`, (b) a real probe POST
  to `POST /api/rails/mail/share` on thread `wih:pipeline-probe`. If the port
  is free or the probe fails auth, THE SYSTEM SHALL start the dev instance via
  `dev/scripts/start-api.sh` (which sets `ALLTERNIT_LOCAL_DEV_BYPASS=1`) and
  re-probe until healthy (timeout 60s). IF rails still does not accept the
  probe (e.g. port held by the packaged app), THE SYSTEM SHALL exit non-zero
  with a message naming the blocker. There is NO fallback path: the pipeline
  aborts when rails cannot be made to work.
- [ ] R1: WHEN a scout run executes, THE SYSTEM SHALL first run
  `rails-ensure.sh` and abort non-zero if it fails; then call `fetchAllSources()`
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
- [ ] R4: WHEN the scout run reaches R3, rails has already been proven working
  by R0/R1 — a failed announcement after that is a hard error: THE SYSTEM SHALL
  record it in `.pipeline/errors.log` and exit non-zero. There is no
  skip-and-continue path for rails failures.

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
- Scenario: a re-run drains the backlog without duplicating
  Given `seen.json` from the previous scenario
  When the scout runs again with the same sources
  Then briefs are written only for items not already in `seen.json` (the
  remaining 3), no item is briefed twice, and a third run writes nothing and
  makes no announcements.
- Scenario: rails outage aborts the run loudly
  Given rails cannot be made healthy by rails-ensure (dead port, blocked auth)
  When the scout runs
  Then it exits non-zero before writing any brief, and the error names the
  blocker.
- Scenario: rails-ensure self-heals a free port
  Given nothing is listening on port 8013 and the debug binary exists
  When rails-ensure runs
  Then the dev API is started and the probe POST to `wih:pipeline-probe`
  succeeds within 60s.
