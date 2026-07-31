# .pipeline — Discovery-to-spec pipeline

An automated loop that watches AI/agent-systems sources, writes mechanism
briefs for the most relevant new items, announces them over rails mail, and
(later phases) turns them into verified specs for executor agents.

## Phase roadmap

- **Phase 1 (this): scout** — discover → brief → announce.
  - `bin/rails-ensure.sh` — proves rails (port 8013) accepts pipeline writes,
    self-healing via the dev API; hard-fails otherwise (no fallback).
  - `bin/scout.cjs` — fetches sources via `.github/scripts/lib/pipeline.cjs`,
    writes briefs for the top-5 unseen items to `briefs/`, tracks slugs in
    `seen.json`, announces each to rails thread `wih:pipeline-discovery`.
- **Phase 2: generator** — deterministic brief → spec (OpenSpec + EARS +
  Gherkin, no LLM). Outputs to `specs/`.
- **Phase 3: spec-checker + queue** — READY/NEEDS-WORK review loop (3-round
  cap), `.pipeline/queue/` for executor consumption, memory ingestion of
  rejection patterns.

## Running the scout

```bash
node .pipeline/bin/scout.cjs
```

Prerequisites: rails must be reachable AND writable. The scout runs
`bin/rails-ensure.sh` first; if nothing healthy is on port 8013 it starts the
dev API (`dev/scripts/start-api.sh`, which sets `ALLTERNIT_LOCAL_DEV_BYPASS=1`
— same as `make api`). If the port is held by an instance that rejects
pipeline writes (e.g. the packaged app), it exits non-zero naming the blocker:
run `make stop && make api` or stop the packaged app. There is no fallback.

If `KIMI_API_KEY` is set, briefs are drafted by `callKimi()` from the repo's
pipeline lib; otherwise a `TODO(agent)` template is written per brief.

## Testing

```bash
node .pipeline/bin/scout-test.cjs
```

Offline: stubs the source fetch and the rails announce; verifies the three
offline-testable Gherkin scenarios from `.steering/spec.md` (fresh run caps at
5 briefs, re-run drains the backlog without duplicating, rails outage aborts
before any brief).

## Layout

- `bin/` — committed code
- `briefs/`, `specs/`, `queue/`, `seen.json`, `errors.log` — gitignored
  runtime artifacts (multi-machine sync is via rails asset refs, not git)
