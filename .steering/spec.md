# Steering spec — Discovery-to-spec pipeline: scout (Phase 1) + generator (Phase 2)

<!-- SOURCE OF TRUTH for this feature. The steering agent maps every requirement
     to DONE / PARTIAL / MISSING with code evidence at each checkpoint.
     v2: split per spec-review — Phase 1 is the scout only; deterministic
     generator = Phase 2, spec-checker loop + queue = Phase 3.
     v3: Phase 1 R0–R4 reviewed, frozen, and marked complete (2026-07-31);
     P1 prose + idempotency Gherkin corrected per steering rulings.
     v4: Phase 2 requirements R5–R8 added (2026-07-31) — retroactively
     numbered from TASK.md Build steps 1–3 per steering review of the
     Phase 2 commit. -->

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

## Requirements (Phase 1 — scout) — COMPLETE, frozen by steering ruling

- [x] R0: `.pipeline/bin/rails-ensure.sh` — WHEN invoked, THE SYSTEM SHALL
  verify rails works by (a) GET `localhost:8013/health`, (b) a real probe POST
  to `POST /api/rails/mail/share` on thread `wih:pipeline-probe`. If the port
  is free or the probe fails auth, THE SYSTEM SHALL start the dev instance via
  `dev/scripts/start-api.sh` (which sets `ALLTERNIT_LOCAL_DEV_BYPASS=1`) and
  re-probe until healthy (timeout 60s). IF rails still does not accept the
  probe (e.g. port held by the packaged app), THE SYSTEM SHALL exit non-zero
  with a message naming the blocker. There is NO fallback path: the pipeline
  aborts when rails cannot be made to work.
- [x] R1: WHEN a scout run executes, THE SYSTEM SHALL first run
  `rails-ensure.sh` and abort non-zero if it fails; then call `fetchAllSources()`
  with social sources disabled where option flags allow, iterate
  `result.filtered`, and write a mechanism brief (what it does, how it works
  internally, candidate integration surface in this repo) per item to
  `.pipeline/briefs/<slug>.md` — but only for the top 5 items by relevance
  score among items not already in `.pipeline/seen.json` (dedup filter first,
  then cap).
- [x] R2: WHEN a scout run starts, THE SYSTEM SHALL load `.pipeline/seen.json`
  (a JSON array of item slugs from prior runs) and skip any item already
  listed; WHEN a brief is written, THE SYSTEM SHALL append its slug and persist
  the file (cross-run idempotency).
- [x] R3: WHEN a brief is written, THE SYSTEM SHALL announce it to rails thread
  `wih:pipeline-discovery` via `POST /api/rails/mail/share` (thread is
  auto-created by the endpoint).
- [x] R4: WHEN the scout run reaches R3, rails has already been proven working
  by R0/R1 — a failed announcement after that is a hard error: THE SYSTEM SHALL
  record it in `.pipeline/errors.log` and exit non-zero. There is no
  skip-and-continue path for rails failures.

## Requirements (Phase 2 — deterministic generator)

- [x] R5: WHEN a brief is written (LLM path or TODO(agent) fallback), THE
  SYSTEM SHALL emit the structured brief format: `## What it is` (one
  paragraph), `## Mechanism` (bulleted internal facts), `## Integration
  surface` (bullets `- <repo path or subsystem>: <what would change>`), and
  `## Requirements seed` (2-6 bullets, each `WHEN <trigger>, THE SYSTEM
  SHALL <observable behavior>`); an optional `## Excluded` section lists
  anything explicitly out.
- [x] R6: WHEN `generate-spec.cjs` processes a brief, THE SYSTEM SHALL parse
  strictly — a brief missing `## Requirements seed` (or `## What it is`), or
  with a seed bullet not matching the WHEN/SHALL shape, SHALL be rejected
  with an error naming the brief and the offending line. Unparseable briefs
  are rejected, never improvised. THE SYSTEM SHALL make no LLM or network
  calls (grep-checkable: Node built-ins only).
- [x] R7: WHEN a brief parses, THE SYSTEM SHALL emit
  `.pipeline/specs/<slug>.md` in the OpenSpec-profile layout: Context (from
  What it is + source URL), Requirements (R1..Rn verbatim from the seed
  bullets), Out of scope (boilerplate + the brief's `## Excluded`), and
  Acceptance (one Gherkin scenario per requirement, mechanically expanded
  When=<trigger> / Then=<behavior>). Regenerating from an unchanged brief
  SHALL produce a byte-identical spec; `.pipeline/specs/.generated.json`
  SHALL map slug → brief SHA-256 so unchanged briefs are skipped.
- [x] R8: WHEN the generator test runs (`generate-spec-test.cjs`), THE
  SYSTEM SHALL verify offline — with fixture briefs (valid + two malformed)
  and no network — that valid briefs convert with EARS form preserved,
  malformed briefs are rejected with the right error lines, regeneration is
  byte-identical, and the manifest is updated.

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

- Phase 3: spec-checker loop (READY/NEEDS-WORK, 3-round cap), `.pipeline/queue/`,
  memory ingestion of rejection patterns (port 3201).
- Executor consumption of the queue, self-improve lineage integration,
  auto-merge, issue-tracker sync.

## Acceptance (Gherkin)

### Phase 1 — scout

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

### Phase 2 — generator

- Scenario: a valid brief converts to a spec
  Given a fixture brief with 3 EARS requirements seed bullets
  When the generator runs
  Then the spec contains R1..R3 verbatim, one Gherkin scenario per
  requirement, Context from What it is + source URL, and the brief's
  `## Excluded` items under Out of scope.
- Scenario: a malformed brief is rejected, not improvised
  Given a brief missing `## Requirements seed`, or with a seed bullet not in
  WHEN/SHALL shape
  When the generator runs
  Then it exits non-zero, the error names the brief and the offending line,
  and no spec is written for that brief.
- Scenario: regeneration is deterministic and idempotent
  Given a spec generated from a valid brief
  When the generator runs again on the unchanged brief
  Then the spec is byte-identical, `.generated.json` maps the slug to the
  brief's SHA-256, and the unchanged brief is skipped in all-briefs mode.
