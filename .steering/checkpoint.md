# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase C2+C3 (spec: .steering/spec.md C2-R1..R3 + C3-R1, task:
docs/TASTE_C2_TASK.md): wiki connector (brain → candidates, enforcement-only),
dismissal ledger with 14-day suppression in scout.cjs, and schema-versioned
frontmatter contracts on pipeline artifacts (briefs, specs, verdict records)
with golden-file tests. Constraints: wiki read-only; memory advisory; rails
untouched; scout-test.cjs / generate-spec-test.cjs stay green.

## Just did

All built and green (7/7 suites: scout, generate-spec, taste, check-spec,
build-queue, contract-test 17/17, wiki-test 38/38):
- `.pipeline/bin/wiki-ingest.sh` — wiki connector: idea/pain →
  `candidates/<slug>.md` (source_page, trust_tier: unverified, ingested_at);
  all pages → memory advisory (idea/pain unverified, context trusted); ledger
  keys `wiki:<relpath>`; wiki read-only; content never executed.
- `.pipeline/bin/dismiss.sh` — dismissal ledger `dismissals.json` + failed-tier
  memory precedent (advisory).
- `scout.cjs` — <14-day normalized-title dismissal suppression (logged +
  cited, item stays unseen, additive filter) + C3-R1 brief frontmatter.
- `generate-spec.cjs` / `check-spec.sh` — spec + review-record frontmatter
  (schema_version/trust_tier/provenance_refs/produced_by/produced_at).
- `contract-test.sh` + `taste/golden/` fixtures; `wiki-test.sh` (injection
  test, suppression window, memory-down paths).
- NOTES at docs/TASTE_C2_NOTES.md + sentinel. Deviation of note: produced_at
  is wall-clock; determinism comparisons mask that one line (documented in
  NOTES + generate-spec docstring).

## Next

Commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline):
wiki connector + artifact contracts (C2+C3)"`. Fix and retry if the gate
blocks.

## Open questions

- (none)
