# PHASE 1 TASK — Discovery pipeline: rails-ensure + scout

You are the executor. This file is your complete task spec. The feature spec is
`.steering/spec.md` (R0–R4, C1–C3, Gherkin acceptance) — read it first; it is the
source of truth for WHAT. This file is the HOW. Do not start Phase 2 work
(generator, spec-checker, queue).

## Workflow requirements (mandatory)

1. At every meaningful checkpoint, update `.steering/checkpoint.md` (Goal / Just
   did / Next / Open questions). An automated reviewer reads it.
2. If a `[steering]` message appears, it is an independent reviewer — treat it as
   authoritative: fix what it flags, answer its questions, update the checkpoint.
3. When done and verified: write `docs/PIPELINE_PHASE_1_NOTES.md` with YAML
   frontmatter (`status: done|blocked`, `files_changed`, `deviations`,
   `remaining`), then `touch docs/PIPELINE_PHASE_1_NOTES.sentinel`.
4. THEN commit: `git add .pipeline .steering docs Makefile && git commit -m "feat(pipeline): rails-ensure + discovery scout (Phase 1)"`.
   An automated gate reviews the commit; if blocked, fix and retry.

## Build these files

1. `.pipeline/bin/rails-ensure.sh` (bash, `set -uo pipefail`):
   - Probe: `curl -sf --max-time 5 http://localhost:8013/health`, then a REAL
     probe POST to `http://localhost:8013/api/rails/mail/share` with
     `{"thread":"wih:pipeline-probe","asset_ref":"/tmp/pipeline-probe","note":"probe"}`
     (use `http://localhost:8013`, NOT 127.0.0.1 — the auth bypass checks the
     Host header for "localhost").
   - If the probe POST succeeds (HTTP 2xx): print "rails: OK", exit 0.
   - Else if the port is free OR the health check fails: start the dev API via
     `dev/scripts/start-api.sh` (repo root resolved with
     `git rev-parse --show-toplevel`), then re-probe in a loop until success or
     60s timeout. Success: exit 0.
   - Else (port held but probe rejected, e.g. packaged app instance): print the
     blocker to stderr ("rails: port 8013 held by an instance that rejects
     pipeline writes — run `make stop && make api` or stop the packaged app")
     and exit 1. NO fallback, NO skip.
2. `.pipeline/bin/scout.cjs` (Node CJS, runs with `node .pipeline/bin/scout.cjs`):
   - Requires `.github/scripts/lib/pipeline.cjs` (check its `module.exports`
     first and use what it actually exports).
   - Runs `rails-ensure.sh` first; aborts non-zero if it fails (R1).
   - Calls `fetchAllSources()` with social sources disabled where option flags
     exist (check the function signature; if flags don't exist, filter out
     twitter/x/bluesky/mastodon items after the fetch). Uses `.filtered`.
   - Loads `.pipeline/seen.json` (array of slugs; tolerate missing file).
   - Dedup filter first, then cap: top 5 by score among unseen items.
   - For each selected item, generates a mechanism brief: use the repo's
     existing `callKimi()` from pipeline.cjs if exported, else a plain HTTPS
     call is out of scope — if no LLM helper is exported, write the brief
     template with the item's title/url/score and a `TODO(agent)` body marker
     instead, and note the deviation in NOTES. Brief sections: What it is /
     How it works internally / Candidate integration surface in this repo.
   - Writes `.pipeline/briefs/<slug>.md`, appends slug to `seen.json`, announces
     each brief to `wih:pipeline-discovery` via
     `POST http://localhost:8013/api/rails/mail/share`
     `{"thread":"wih:pipeline-discovery","asset_ref":"<abs path to brief>","note":"<title>"}`.
   - Announcement failure after a successful ensure: append to
     `.pipeline/errors.log`, exit non-zero (R4).
   - Slug: lowercase alnum+dash from the item title, max 60 chars, dedupe by
     appending short hash if collision.
3. `.pipeline/.gitignore`: `briefs/`, `specs/`, `queue/`, `seen.json`,
   `errors.log` (C3).
4. `.pipeline/README.md`: what the pipeline is, how to run the scout
   (`node .pipeline/bin/scout.cjs`), rails dependency (`rails-ensure.sh`,
   `make api`), the phase roadmap (2: generator, 3: spec-checker+queue).
5. `.pipeline/bin/scout-test.cjs`: a test that stubs the source fetch (DO NOT
   hit the network — stub `fetchAllSources` via a local fixture or a
   dependency-injected module path) and verifies the three Gherkin scenarios
   from `.steering/spec.md` that are testable offline: (a) 8 items → exactly 5
   briefs + 5 slugs in seen.json; (b) re-run → 0 new briefs; (c) ensure-failure
   → non-zero exit before any brief is written. For (a)/(b) also stub the
   rails announce call (capture, don't POST). Print PASS/FAIL lines, exit
   non-zero on any FAIL.

## Constraints

- Check `.github/scripts/lib/pipeline.cjs` `module.exports` and
  `fetchAllSources` signature BEFORE writing scout.cjs — code against reality.
- No builds, no cargo, no test suites beyond scout-test.cjs.
- No changes to `.github/scripts/lib/pipeline.cjs` itself.
- Node built-ins only for scout.cjs (no new npm deps).
- Run `node .pipeline/bin/scout-test.cjs` and record PASS output in NOTES.

## Acceptance

All spec Gherkin scenarios verified (network-dependent ones by code review +
the stubbed test; rails-ensure self-heal by running it against the live dev
API if healthy, or by code review if not). Record exact commands + outputs in
NOTES.
