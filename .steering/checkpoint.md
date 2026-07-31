# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase 3 of the discovery-to-spec pipeline: independent spec-checker loop
(rubric + ao-steer consult), queue promotion for READY specs, and memory
ingestion of rejection patterns. Rails is the only hard dependency; memory
is advisory.

## Just did

Applied the steering STEER from the mid-phase review:
- **MAJOR fixed** — READY path reordered in check-spec.sh: announce to
  `wih:pipeline-queue` FIRST; only on 2xx does the spec move to `queue/` and
  the verdict get recorded. Announce failure now leaves the spec untouched
  in `specs/` with its prior state, so the next run re-consults and retries.
  Regression coverage added to check-spec-test.sh: announce-failure leaves
  no queue file + no READY verdict + errors.log entry + exit 1, and a
  follow-up run after "rails recovery" completes the READY path. Suite now
  28/28 PASS.
- **MINOR fixed** — a spec's accumulated `<slug>.review.md` now moves to
  `queue/` alongside the spec.
- Follow-up noted in NOTES (not changed): scout.cjs's seen.json-before-
  announce ordering (Phase 1 frozen per its ruling).
- Real run completed with the LIVE ao-steer: NEEDS-WORK round 1 on the
  osreward spec, findings verbatim in `.pipeline/specs/osreward-….review.md`,
  verdicts.json rounds=1. Steering agent confirmed independently.
- Phase 3 requirements R9–R12 + Gherkin already in `.steering/spec.md`;
  NOTES + sentinel written.

## Next

Gated commit: `git add .pipeline .steering docs && git commit -m
"feat(pipeline): spec-checker loop + queue + memory lessons (Phase 3)"`.

## Open questions

- (none — steering's MAJOR/MINOR both addressed; the scout.cjs ordering note
  is recorded as a follow-up in NOTES, not an open question)
