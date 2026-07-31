---
status: done
files_changed:
  - .pipeline/bin/rails-ensure.sh
  - .pipeline/bin/scout.cjs
  - .pipeline/bin/scout-test.cjs
  - .pipeline/.gitignore
  - .pipeline/README.md
  - .steering/checkpoint.md
  - .steering/spec.md
  - docs/PIPELINE_PHASE_1_NOTES.md
deviations:
  - "Brief bodies: callKimi IS exported by pipeline.cjs, so scout.cjs uses it
    when KIMI_API_KEY is set; otherwise it writes the TODO(agent) template
    (allowed by the task). Live runs in this session used the template path
    (no KIMI_API_KEY in env)."
  - "rails-ensure self-heal end-to-end not verified against the real dev API:
    target/debug/allternit-api does not exist in this worktree and the task
    forbids cargo builds. Verified instead: (1) free-port branch invokes
    dev/scripts/start-api.sh and times out with a named blocker after 60s
    (real run, exit 1); (2) happy path against a mock rails on 8013 ->
    'rails: OK', exit 0; (3) blocker path (port held, health OK, POST 401)
    -> exact blocker message, exit 1, no start attempted. Spec P1 prose
    corrected per steering ruling (binary is a build prerequisite, not
    asserted prebuilt)."
  - "spec.md Gherkin scenario 'a re-run is idempotent' was self-contradictory
    with R1's 'dedup filter first, then cap' for >5 items. Steering ruled for
    R1's text (drain backlog, never starve rank-6+ items); the scenario was
    rewritten to 'a re-run drains the backlog without duplicating' and the
    code implements dedup-first-then-cap."
remaining:
  - "Phase 2: deterministic brief->spec generator (out of scope here)."
  - "Phase 3: spec-checker loop + queue (out of scope here)."
---

# Phase 1 NOTES — rails-ensure + discovery scout

## What was built

- `.pipeline/bin/rails-ensure.sh` (R0): probes `GET localhost:8013/health`
  then a real probe POST to `/api/rails/mail/share` on thread
  `wih:pipeline-probe`. Success → `rails: OK`, exit 0. Port free or health
  failing → starts `dev/scripts/start-api.sh` (repo root via
  `git rev-parse --show-toplevel`), re-probes in a 2s loop up to 60s. Port
  held but probe rejected → exact blocker message to stderr, exit 1. Uses
  `localhost` (not 127.0.0.1) for the Host-header auth bypass. No fallback.
- `.pipeline/bin/scout.cjs` (R1–R4): runs rails-ensure first (abort non-zero
  on failure, before any brief). Calls `fetchAllSources()` from
  `.github/scripts/lib/pipeline.cjs` with `includeXCurated/includeBluesky/
  includeMastodon: false` (flags exist); twitter has no flag, so items with
  source ∈ {twitter, x, bluesky, mastodon} are post-filtered out of
  `.filtered`. Selection: dedup filter first (skip slugs already in
  `.pipeline/seen.json`), then cap — top 5 by relevance score among unseen
  items (drains the backlog across runs, never re-briefs). Writes
  `.pipeline/briefs/<slug>.md` (sections: What it is / How it works
  internally / Candidate integration surface in this repo; via `callKimi()`
  when available, else TODO(agent) template), appends each slug to seen.json
  (persisted per brief), announces each brief to `wih:pipeline-discovery`
  with the absolute brief path as `asset_ref`. Announce failure → append to
  `.pipeline/errors.log`, exit non-zero (R4). Slugs: lowercase alnum+dash,
  ≤60 chars, sha1(url)[:8] suffix on collision.
- `.pipeline/.gitignore` (C3): `briefs/ specs/ queue/ seen.json errors.log`.
- `.pipeline/README.md`: pipeline overview, run/test instructions, rails
  dependency, phase roadmap.
- `.pipeline/bin/scout-test.cjs`: fully offline (stubbed fetchAllSources via
  `SCOUT_PIPELINE_MODULE`, stubbed ensure via `SCOUT_RAILS_ENSURE`, captured
  announcements via `SCOUT_ANNOUNCER`). 20 checks, all PASS.

No changes to `.github/scripts/lib/pipeline.cjs`. Node built-ins only.

## Verification (exact commands + outputs)

### Stubbed test (Gherkin scenarios a/b/c)

```
$ node .pipeline/bin/scout-test.cjs
PASS: (a) scout exits 0 on fresh run
PASS: (a) exactly 5 briefs written
PASS: (a) seen.json lists 5 slugs
PASS: (a) 5 announcements captured
PASS: (a) top 5 by score selected (dedup filter first, then cap)
PASS: (a) announcements target wih:pipeline-discovery with brief asset_ref
PASS: (a) brief has 3 mechanism sections + TODO(agent) fallback
PASS: (b) re-run exits 0
PASS: (b) remaining 3 backlog items briefed (8 total)
PASS: (b) seen.json lists all 8 slugs
PASS: (b) 3 new announcements (8 total)
PASS: (b) no item briefed twice
PASS: (b) backlog items are the previously-unseen 3
PASS: (b) third run exits 0
PASS: (b) third run writes nothing
PASS: (b) third run makes no announcements
PASS: (c) scout exits non-zero when rails-ensure fails
PASS: (c) no brief written before abort
PASS: (c) error names the blocker
PASS: (c) seen.json never created

All checks passed.
```

### rails-ensure, free port, no binary (real run)

```
$ bash .pipeline/bin/rails-ensure.sh; echo "exit=$?"
rails: probe rejected; starting dev API via dev/scripts/start-api.sh
[start-api] Binary not found at .../target/debug/allternit-api
[start-api] Run 'cargo build --bin allternit-api' from the workspace root first.
rails: dev API did not accept the pipeline probe within 60s — check /tmp/allternit-api.log
exit=1
```

### rails-ensure happy path (mock rails on 8013, accepts writes)

```
$ bash .pipeline/bin/rails-ensure.sh; echo "exit=$?"
rails: OK
exit=0
```

### rails-ensure blocker path (mock: health 200, share POST 401)

```
$ bash .pipeline/bin/rails-ensure.sh; echo "exit=$?"
rails: port 8013 held by an instance that rejects pipeline writes — run `make stop && make api` or stop the packaged app
exit=1
```

### R4 live: announce failure after successful ensure

Mock accepted the probe thread but returned 500 for `wih:pipeline-discovery`:

```
$ SCOUT_DIR=/tmp/scout-live/state SCOUT_PIPELINE_MODULE=/tmp/scout-live/fixture.cjs node .pipeline/bin/scout.cjs; echo "exit=$?"
rails: OK
scout: brief written /tmp/scout-live/state/briefs/live-test-alpha.md
scout: rails announcement failed for "live-test-alpha" — recorded in /tmp/scout-live/state/errors.log; aborting
exit=1
# errors.log: [...] announce failed for ... ("Live Test Alpha"): rails announce returned HTTP 500
```

### R3 live: successful announcements over real HTTP

```
rails: OK
scout: brief written .../live-test-alpha.md
scout: announced "Live Test Alpha" to wih:pipeline-discovery
scout: brief written .../live-test-beta.md
scout: announced "Live Test Beta" to wih:pipeline-discovery
scout: done — 2 brief(s), seen.json now holds 2 slug(s)
exit=0
# mock received probe POST + both discovery announcements with correct
# thread / asset_ref (abs path) / note (title)
```

## Gherkin acceptance mapping

- Fresh run produces capped, announced briefs → scout-test (a), 7 PASS checks.
- Re-run drains the backlog without duplicating → scout-test (b), 9 PASS
  checks (re-run briefs the remaining 3, no duplicates, third run no-op).
- Rails outage aborts loudly → scout-test (c), 4 PASS checks + real-run
  free-port/no-binary output above.
- rails-ensure self-heals a free port → PARTIAL by environment: the
  free-port branch does invoke `dev/scripts/start-api.sh` (verified in the
  real run), but the debug binary is absent in this worktree and cargo builds
  are forbidden by the task, so the 60s-success leg is verified by code
  review only. Happy/blocker branches verified live against mocks.
