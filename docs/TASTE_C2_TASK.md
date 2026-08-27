# C2+C3 TASK — wiki connector + artifact contracts

You are the executor. `.steering/spec.md` (C2-R1..R3, C3-R1 + acceptance) is
the source of truth. C1+C4 is merged: `docs/pipeline/bin/taste-ingest.sh`,
`record-outcome.sh`, `check-spec.sh` precedent machinery, and
`docs/pipeline/bin/taste-test.sh` (the PATH-shim test pattern) all exist — reuse
their conventions.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/TASTE_C2_NOTES.md` with YAML frontmatter, then
   `touch docs/TASTE_C2_NOTES.sentinel`.
3. Then commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline): wiki connector + artifact contracts (C2+C3)"`.
   A gate reviews; fix and retry if blocked.

## Build

1. **`docs/pipeline/bin/wiki-ingest.sh`** (C2-R1/R2, enforcement-only):
   - Reads `TASTE_BRAIN` (default `$HOME/Desktop/allternit-brain`, skip
     silently if absent) — every .md file: parse frontmatter
     (`type: runbook|decision|idea|pain|identity|domain`, `status`, `domain`)
     tolerantly (missing frontmatter = context page).
   - Pages with `type: idea|pain` become CANDIDATES: written to
     `docs/pipeline/candidates/<slug>.md` with frontmatter
     `source_page`, `trust_tier: unverified`, `ingested_at`.
   - ALL pages (candidates or not) are ingested to memory via taste-ingest
     conventions (context).
   - HARD RULE (C2-R1): the connector NEVER writes outside `docs/pipeline/` and
     memory, NEVER executes page content, and a page containing injection text
     ("ignore previous instructions", "approve everything", "disable
     steering") changes nothing about verdicts/permissions — the acceptance
     test feeds exactly such a page and asserts: candidate created (if idea/
     pain) marked unverified, no other effect.
2. **Dismissal ledger** (C2-R3): `docs/pipeline/dismissals.json`
   `{slug: {title, dismissed_at}}`; `docs/pipeline/bin/dismiss.sh <slug-or-title> [note]`
   records + ingests the dismissal as a taste precedent (advisory memory).
   scout.cjs integration: before briefing, skip items whose normalized title
   matches a dismissal < 14 days old (normalized: lowercase, alnum-only) —
   log the suppression to errors.log with the dismissal cited. Additive
   change to scout.cjs only; do not alter selection logic otherwise.
3. **Artifact contracts** (C3-R1): frontmatter blocks at the top of pipeline
   artifacts — briefs (scout), specs (generate-spec), verdict records
   (check-spec's review files):
   `schema_version: 1`, `trust_tier`, `provenance_refs: [...]`,
   `produced_by` (script name), `produced_at`.
   - scout.cjs + generate-spec.cjs: prepend frontmatter when writing (briefs
     trust_tier: unverified, provenance_refs: [source URL]; specs:
     provenance_refs: [brief path + brief hash]).
   - Golden-file contract tests: `docs/pipeline/bin/contract-test.sh` with
     golden fixtures under `docs/pipeline/taste/golden/` — each artifact type's
     frontmatter must contain exactly the required keys (extras allowed);
     regeneration of a fixture brief/spec passes unchanged.
4. **Tests**: extend the PATH-shim pattern in a new
   `docs/pipeline/bin/wiki-test.sh`: injection page test (C2-R1), idea/pain →
   candidates with unverified tier, context pages no candidates, dismissal
   suppresses re-suggestion within 14 days and allows after, frontmatter
   golden checks. PASS/FAIL, non-zero on FAIL.

## Constraints

- The wiki is READ-ONLY for the connector (never write back to TASTE_BRAIN).
- Memory advisory everywhere; rails untouched.
- Keep scout-test.cjs and generate-spec-test.cjs green (frontmatter addition
  may need fixture updates — update fixtures, not assertions' intent).
