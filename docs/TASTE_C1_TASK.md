# C1+C4 TASK — taste corpus + outcome feedback loop

You are the executor. `.steering/spec.md` (C1-R1, C1-R2, C4-R1, C4-R2 +
acceptance) is the source of truth. Read `.pipeline/TRACK-C-taste-engine.md`
context section and `.pipeline/bin/check-spec.sh` (query_precedents +
ingest_lesson) first — you are extending existing machinery, not rebuilding.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/TASTE_C1_NOTES.md` with YAML frontmatter, then
   `touch docs/TASTE_C1_NOTES.sentinel`.
3. Then commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline): taste corpus + outcome feedback loop (C1+C4)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. **`.pipeline/bin/taste-ingest.sh`** (bash + python3, like .steering/bin):
   - Sources (env-overridable paths):
     a. `TASTE_REPO_DOCS` (default: repo root) — AGENTS.md, DESIGN.md, README.md,
        docs/*.md top-level → ingested as `trusted` (source: "repo-docs").
     b. `TASTE_BRAIN` (default: `$HOME/Desktop/allternit-brain` if it exists,
        else skip silently) — all .md files → `trusted` ("brain").
     c. `TASTE_SESSIONS` (default: skip unless set) — agent session dirs; when
        set, ingest per-session first+last 2KB with
        `trust_tier` from a companion `.pipeline/taste/trust-rules.json`
        mapping path patterns to tiers (default: everything `unverified`;
        patterns containing "revert"/"failed" → `failed`).
   - Each item POSTed to `http://localhost:3201/api/ingest` with metadata
     `{source, trust_tier, provenance_ref}`. Memory down = log to
     `.pipeline/errors.log` and continue (advisory, like check-spec).
   - Idempotent-ish: `.pipeline/taste/ingested.json` ledger of
     path+content-hash → skip unchanged on re-run.
2. **Outcome feedback**: `.pipeline/bin/record-outcome.sh <slug> <outcome> [note]`
   (outcome: merged|reverted|rejected):
   - Appends `{ts, slug, outcome, note}` to `.pipeline/outcomes.jsonl`.
   - Ingests the outcome to memory as a taste precedent (advisory).
   - Wire it: document in `.pipeline/README.md` that human merge/reject
     decisions at the queue/merge stage should be recorded with this command
     (the build-queue announce step stays as-is).
3. **Precedent staleness**: extend `query_precedents` in check-spec.sh so
   items whose ingested date is >90 days old (memory items carry timestamps;
   degrade gracefully when absent) are marked `[stale]` in the assembled
   precedent text rather than presented as current.
4. **Tests** (`.pipeline/bin/taste-test.sh`): stub curl like
   check-spec-test.sh does. Verify: ingest posts correct metadata per source
   class; trust-rules map failed patterns to `failed`; re-run skips unchanged
   paths; record-outcome appends + posts; stale marking appears for old
   precedents; memory-down paths log and continue. PASS/FAIL, non-zero on FAIL.

## Constraints

- Memory (3201) is ADVISORY everywhere — never a hard dependency.
- No changes to scout/generate-spec/build-queue behavior.
- Node/bash built-ins + python3 only.
