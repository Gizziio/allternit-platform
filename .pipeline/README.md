# .pipeline — Discovery-to-spec pipeline

An automated loop that watches AI/agent-systems sources, writes mechanism
briefs for the most relevant new items, announces them over rails mail, and
(later phases) turns them into verified specs for executor agents.

## Phase roadmap

- **Phase 1: scout** — discover → brief → announce.
  - `bin/rails-ensure.sh` — proves rails (port 8013) accepts pipeline writes,
    self-healing via the dev API; hard-fails otherwise (no fallback).
  - `bin/scout.cjs` — fetches sources via `.github/scripts/lib/pipeline.cjs`,
    writes briefs for the top-5 unseen items to `briefs/`, tracks slugs in
    `seen.json`, announces each to rails thread `wih:pipeline-discovery`.
- **Phase 2: generator** — deterministic brief → spec (OpenSpec +
  EARS + Gherkin, no LLM).
  - `bin/generate-spec.cjs` — parses the structured brief format and emits
    `.pipeline/specs/<slug>.md`; strict (malformed briefs rejected, never
    improvised), deterministic (byte-identical regen), manifest at
    `specs/.generated.json`.
- **Phase 3 (this): spec-checker + queue** — READY/NEEDS-WORK review loop
  (3-round cap), `.pipeline/queue/` for executor consumption, memory
  ingestion of rejection patterns.
  - `spec-rubric.md` — the reviewer's prompt: verdict-able requirements,
    acceptance that proves its requirement, right-sizing, phase boundaries.
  - `bin/check-spec.sh` — consults the independent reviewer (`ao-consult`;
    `SPEC_CHECK_CMD` overrides for tests) per unverdicted spec. READY →
    `queue/` + rails announce to `wih:pipeline-queue` (hard error on
    failure); NEEDS-WORK → findings in `specs/<slug>.review.md`, 3 rounds →
    STALLED; 2nd NEEDS-WORK ingests the rejection pattern to memory (:3201,
    advisory only). Verdicts in `verdicts.json`.

## The full cycle

```
discover ──▶ brief ──▶ generate ──▶ check ──▶ queue
(scout.cjs)  briefs/   (generate-   (check-    queue/
                       spec.cjs)    spec.sh)   + wih:pipeline-queue
```

```bash
node .pipeline/bin/scout.cjs && node .pipeline/bin/generate-spec.cjs && bash .pipeline/bin/check-spec.sh
```

## Brief format (parsed by the generator)

Both the LLM path and the `TODO(agent)` fallback in the scout emit exactly
this structure; an agent completes the TODO sections before generating:

```markdown
# <title>

- Source: <source>
- URL: <url>
- Relevance score: <0..1>

## What it is

One paragraph.

## Mechanism

- Fact about how it works internally

## Integration surface

- <repo path or subsystem>: <what would change>

## Requirements seed

- WHEN <trigger>, THE SYSTEM SHALL <observable behavior>
- WHEN <trigger>, THE SYSTEM SHALL <observable behavior>

## Excluded            ← optional, merged into the spec's Out of scope

- <anything explicitly out>
```

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
pipeline lib; otherwise a `TODO(agent)` template is written per brief — an
agent completes the structured sections before the generator will accept the
brief (raw TODO placeholders are rejected by the strict parser).

## Running the generator

```bash
# One brief (regenerates unconditionally):
node .pipeline/bin/generate-spec.cjs .pipeline/briefs/<slug>.md

# All new/changed briefs (skips up-to-date via specs/.generated.json):
node .pipeline/bin/generate-spec.cjs
```

Emits `.pipeline/specs/<slug>.md` (Context / R1..Rn / Out of scope / Gherkin
acceptance). Deterministic: same brief in → byte-identical spec out. A brief
missing `## Requirements seed` or with a non-`WHEN…THE SYSTEM SHALL` seed
bullet is rejected with an error naming the brief and the offending line —
never improvised.

## Testing

```bash
node .pipeline/bin/scout-test.cjs
node .pipeline/bin/generate-spec-test.cjs
bash .pipeline/bin/check-spec-test.sh
```

Offline: stubs the source fetch and the rails announce; verifies the three
offline-testable Gherkin scenarios from `.steering/spec.md` (fresh run caps at
5 briefs, re-run drains the backlog without duplicating, rails outage aborts
before any brief). The generator test uses fixture briefs (valid + two
malformed) and checks EARS preservation, rejection errors, byte-identical
regeneration, and the manifest. The checker test stubs the consult
(`SPEC_CHECK_CMD`) and curl (PATH shim) and verifies READY/NEEDS-WORK/STALLED
handling, the memory lesson POST, and the advisory memory-failure path.

## Layout

- `bin/`, `spec-rubric.md` — committed code and prompts
- `briefs/`, `specs/`, `queue/`, `seen.json`, `errors.log`, `verdicts.json` —
  gitignored runtime artifacts (multi-machine sync is via rails asset refs,
  not git)
