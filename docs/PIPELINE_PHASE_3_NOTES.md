---
status: done
files_changed:
  - docs/pipeline/spec-rubric.md
  - docs/pipeline/bin/check-spec.sh
  - docs/pipeline/bin/check-spec-test.sh
  - docs/pipeline/.gitignore
  - docs/pipeline/README.md
  - .steering/checkpoint.md
  - .steering/spec.md
  - docs/PIPELINE_PHASE_3_NOTES.md
deviations:
  - "Real run used a mock rails on :8013 for ensure/announce (dev API binary
    absent in this worktree — standing environment deviation since Phase 1);
    the CONSULT was the live ao-steer, which is what the acceptance targets.
    Memory (:3201) was genuinely down, so the advisory path is real, not
    staged (no 2nd NEEDS-WORK has occurred yet on a live spec, so no live
    ingest attempt has fired; the offline test covers it with a curl shim)."
  - "Steering noted scout.cjs has the same record-before-announce ordering
    (seen.json append precedes the R3 announce) as the MAJOR fixed here.
    Phase 1 behavior left unchanged per its frozen ruling; flagged as a
    follow-up."
remaining:
  - "The live NEEDS-WORK round-1 findings on the osreward spec are real
    generator lessons (see below): integrate the brief's Integration surface
    into spec Context, and make Gherkin Given/Then concrete. These are
    generator/brief-template improvements for a future iteration — Phase 3
    constraints forbade changing them now."
  - "Executor consumption of docs/pipeline/queue/ (out of scope, later phase)."
---

# Phase 3 NOTES — Spec-checker loop + queue + memory lessons

## What was built

1. **`docs/pipeline/spec-rubric.md`** — the spec-checker's review prompt, modeled
   on `.steering/prompt.md` but aimed at specs: (1) every requirement
   verdict-able DONE/PARTIAL/MISSING by a future builder, (2) acceptance
   scenarios that actually prove their requirement, (3) right-sized (one
   reviewable unit, not a disguised epic), (4) no conflict with
   `.steering/spec.md` phase boundaries. Verdict contract: first line exactly
   `READY` or `NEEDS-WORK`, then findings citing requirement IDs.
2. **`docs/pipeline/bin/check-spec.sh`** (`set -uo pipefail`):
   - Runs `rails-ensure.sh` first; aborts non-zero on failure.
   - Per `docs/pipeline/specs/*.md` without READY/STALLED in `verdicts.json`:
     assembles rubric + spec, consults via `SPEC_CHECK_CMD` (test hook) else
     `ao-consult`; bullet-prefix tolerant verdict parsing (`sed 's/^• //'`).
   - READY → **announce first** to `wih:pipeline-queue` (asset_ref = queue
     path), then move spec to `queue/` (with its `.review.md` trail) and
     record the verdict. Announce failure: errors.log + exit 1 with the spec
     untouched, so the next run retries the whole READY path. (Ordering fixed
     per steering MAJOR.)
   - NEEDS-WORK → record round, append findings to `specs/<slug>.review.md`;
     2nd round ingests the rejection pattern to memory
     (`POST :3201/api/ingest`, source `pipeline-spec-checker`; failure logged
     to errors.log, advisory); 3rd round marks STALLED, skipped thereafter.
   - Empty/unparseable answer or transport failure → record nothing,
     continue (fail open per-spec).
3. **`docs/pipeline/bin/check-spec-test.sh`** — stubbed consult (canned verdict
   files per slug) + PATH-shimmed curl capture. 28 checks.
4. **`.steering/spec.md`** — Phase 3 requirements R9–R12 + 4 Gherkin
   scenarios (added alongside implementation, applying the Phase 2 gate
   lesson); Out of scope now lists only executor-consumption+.
5. **README** — Phase 3 section, full-cycle diagram
   (discover → brief → generate → check → queue) + one-line command.
   `.gitignore` += `verdicts.json`.

The checker consult is the ONLY LLM step; everything else is bash + python3
(JSON), no jq. No behavior changes to scout.cjs / generate-spec.cjs.

## Verification (exact commands + outputs)

### Offline test

```
$ bash docs/pipeline/bin/check-spec-test.sh
PASS: run 1 exits 0
PASS: READY: spec moved to queue
PASS: READY: spec removed from specs/
PASS: READY: verdict recorded
PASS: READY: announced to wih:pipeline-queue with queue asset_ref
PASS: NEEDS-WORK: verdict + round 1 recorded
PASS: NEEDS-WORK: findings appended to .review.md (bullet-stripped)
PASS: transport failure: no verdict recorded for gamma
PASS: run 1 reports gamma skip
PASS: no memory POST on round 1
PASS: run 2 exits 0
PASS: round 2 recorded
PASS: 2nd NEEDS-WORK triggers memory POST with slug + findings
PASS: review.md now has round 2 section
PASS: READY spec not re-consulted (moved out)
PASS: 3rd NEEDS-WORK marks STALLED
PASS: STALLED spec skipped afterwards
PASS: memory-failure run exits 0 (advisory)
PASS: memory failure logged to errors.log
PASS: round 2 still recorded despite memory failure
PASS: announce failure exits non-zero
PASS: announce failure: spec left in specs/ for retry
PASS: announce failure: no queue file created
PASS: announce failure: no READY verdict recorded
PASS: announce failure logged to errors.log
PASS: retry after rails recovery exits 0
PASS: retry moves spec to queue
PASS: retry records READY verdict

All checks passed.
```

### Real run with the live ao-steer (acceptance)

```
$ bash docs/pipeline/bin/check-spec.sh
rails: OK
submitted to ao-steer
check-spec: osreward-instituting-standardized-evaluation-for-cross-platf — NEEDS-WORK round 1; findings appended to specs/osreward-….review.md
check-spec: done — 1 spec(s) consulted
```

`verdicts.json`: `{"osreward-…": {"verdict":"NEEDS-WORK","rounds":1, …}}`.
The live reviewer's findings (verbatim in
`docs/pipeline/specs/osreward-….review.md`) are substantive and correct:

- **R1–R4 (Acceptance):** all Gherkin scenarios share the boilerplate Given
  and restate the SHALL text as Then — a stub returning "OK" would pass
  them; each needs a concrete Given and an observable Then.
- **R1:** "judge-consumable format" undefined — no schema cited.
- **R2/R3:** "reward-model client" / "run record" referenced as if
  pre-existing; Context never says. Root cause identified by the reviewer:
  the generator drops the brief's Integration surface section.
- **R4:** extensibility property, not a single observable trigger+behavior —
  split it.
- **Right-sizing:** blocked on the missing integration-surface facts.

These findings are exactly the rejection patterns R11's memory ingestion
exists to accumulate (fires at round 2).

## Steering interactions this phase

1. Checkpoint STEER (mid-phase): MAJOR — READY path moved + recorded before
   announcing, making an announce failure unrecoverable. Fixed:
   announce-first ordering, spec/verdict untouched on failure; regression
   test added (7 new checks, incl. retry-after-recovery). MINOR — orphaned
   `.review.md` on queue move: fixed by moving it alongside the spec.
   Follow-up noted: scout.cjs has the analogous seen-before-announce
   ordering (Phase 1 frozen; flagged, not changed).
2. The same steering agent WAS the live reviewer for the real run and
   confirmed the round-1 NEEDS-WORK verdict landed verbatim in
   `.review.md` + `verdicts.json`.
