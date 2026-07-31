# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase 2 of the discovery-to-spec pipeline: a deterministic, LLM-free
brief→spec generator (`.pipeline/bin/generate-spec.cjs`) that parses the
structured brief format into OpenSpec-profile specs (Context / numbered
R1..Rn EARS requirements / Out of scope / mechanical Gherkin acceptance),
byte-identical on regeneration, with a `.generated.json` manifest. Also
tightens the Phase 1 brief template in scout.cjs so briefs are mechanically
parseable. Phase 1 selection logic (dedup-first-then-cap) is frozen by the
steering ruling.

## Just did

Phase 2 complete (first commit attempt BLOCKED by steering with one MAJOR:
spec.md had no Phase 2 requirements — documentation gap only, code verified
DONE on every build step). Applied the ruling:
- `.steering/spec.md` now has "Requirements (Phase 2 — deterministic
  generator)" R5–R8 (structured brief format; strict parsing/rejection, no
  LLM; deterministic OpenSpec-profile emission + manifest; offline test),
  three Phase 2 Gherkin acceptance scenarios lifted from
  generate-spec-test.cjs assertions, Phase 1 R0–R4 marked `[x]` complete and
  frozen, and "Out of scope" reduced to Phase 3+. NOTES updated to match.

(Pre-block state, re-verified by the steering agent itself: brief template
tightened in scout.cjs, scout-test 20/20; generate-spec.cjs strict +
LLM-free + byte-identical regen, generate-spec-test 20/20; real OSReward
brief → spec with R1–R4 + 4 Gherkin scenarios; C3 gitignore verified.)

## Next

Retry the gated commit: `git add .pipeline .steering docs && git commit -m
"feat(pipeline): deterministic brief-to-spec generator (Phase 2)"`.

## Open questions

- (none)
