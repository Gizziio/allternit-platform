# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase C1+C4 taste memory loop (spec: .steering/spec.md, task:
docs/TASTE_C1_TASK.md): taste corpus ingest (repo docs / brain / sessions with
trust tiers) + outcome feedback loop + precedent staleness. Constraints:
memory (:3201) advisory everywhere; no changes to scout/generate-spec/
build-queue behavior; bash + python3 only.

## Just did

All built and green:
- `.pipeline/bin/taste-ingest.sh` — 3 source classes (repo docs + brain →
  trusted; sessions tiered by `.pipeline/taste/trust-rules.json`, default
  unverified, revert/failed patterns → failed), metadata
  {source, trust_tier, provenance_ref}, hash ledger
  `.pipeline/taste/ingested.json` updated only on 2xx, memory-down advisory.
- `.pipeline/bin/record-outcome.sh` — appends {ts,slug,outcome,note} to
  `.pipeline/outcomes.jsonl`, ingests precedent (merged→trusted,
  reverted/rejected→failed); documented in README as the human merge-stage
  command.
- `check-spec.sh` `query_precedents` — `[stale] ` prefix for >90-day items
  (ingested_at/created_at/timestamp/ts/updated_at, ISO or epoch; undated →
  current).
- `.pipeline/bin/taste-test.sh` — 33/33 PASS; check-spec-test.sh still all
  PASS.
- NOTES written to docs/TASTE_C1_NOTES.md with deviations + acceptance
  mapping.

## Next

First commit blocked by the steering gate: C1-R2's consult half was missing —
`query_precedents` read no trust tiers, so failed-tier content read as
undifferentiated evidence. Fixed: failed-tier items are now labeled
`[pitfall]` (composes with `[stale]`), 3 new tests (36/36 PASS), NOTES/README
updated. Retry the commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline): taste
corpus + outcome feedback loop (C1+C4)"`.

## Open questions

- (none)
