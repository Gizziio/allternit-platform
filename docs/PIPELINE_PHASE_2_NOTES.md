---
status: done
files_changed:
  - .pipeline/bin/scout.cjs
  - .pipeline/bin/scout-test.cjs
  - .pipeline/bin/generate-spec.cjs
  - .pipeline/bin/generate-spec-test.cjs
  - .pipeline/README.md
  - .steering/checkpoint.md
  - .steering/spec.md
  - docs/PIPELINE_PHASE_2_NOTES.md
deviations:
  - "Real briefs came from the TODO(agent) template path (KIMI_API_KEY unset
    in this environment); per the designed workflow, one brief
    (osreward-…) was completed by the agent from the arXiv abstract before
    conversion. Raw TODO-placeholder briefs are intentionally REJECTED by the
    generator's strict parser (the 4 other live briefs in .pipeline/briefs/
    remain uncompleted and would be rejected until an agent fills them)."
  - "Generator 'Given' clause is a fixed mechanical line ('the integration
    surface listed in the brief is in place') rather than a per-requirement
    derivation — the task mandates mechanical expansion and forbids
    improvisation; Phase 3's spec-checker can refine."
remaining:
  - "Phase 3: spec-checker loop (READY/NEEDS-WORK, 3-round cap),
    .pipeline/queue/, memory ingestion of rejection patterns."
---

# Phase 2 NOTES — Deterministic brief→spec generator

## What was built

1. **Tightened brief template** (`.pipeline/bin/scout.cjs`): both the
   `callKimi` prompt and the `TODO(agent)` fallback emit exactly:
   - `## What it is` — one paragraph
   - `## Mechanism` — bulleted internal facts
   - `## Integration surface` — `- <repo path or subsystem>: <what would change>`
   - `## Requirements seed` — 2-6 `WHEN <trigger>, THE SYSTEM SHALL <behavior>`
   - optional `## Excluded` — merged into the spec's Out of scope
2. **`.pipeline/bin/generate-spec.cjs`** — deterministic, Node built-ins only,
   no LLM/network (grep-verified: no `fetch`/`http`/`callKimi`). Strict
   parser: missing `## What it is` / `## Requirements seed`, empty sections,
   or seed bullets not matching `/^WHEN (.+), THE SYSTEM SHALL (.+)$/` are
   rejected with an error naming the brief and the offending line — never
   improvised. Emits `.pipeline/specs/<slug>.md` mirroring
   `.steering/spec.md`: Context (What it is + source URL), Requirements
   (R1..Rn verbatim), Out of scope (boilerplate + brief Excluded), Acceptance
   (one Gherkin scenario per requirement, mechanical
   When=<trigger> / Then=<behavior>). Deterministic (no timestamps in output;
   double-run is byte-identical) and idempotent (`.generated.json` maps
   slug → brief sha256; unchanged briefs skipped in all-briefs mode).
3. **`.pipeline/bin/generate-spec-test.cjs`** — fixture briefs (valid + two
   malformed), 20 checks.
4. **README** — Phase 2 section, brief format reference, generator usage,
   test commands.

No changes to Phase 1 selection logic (steering ruling stands).
No changes to `.github/scripts/lib/pipeline.cjs`.

Per steering review of the first Phase 2 commit attempt, `.steering/spec.md`
now carries Phase 2 as numbered requirements R5–R8 (brief structure, strict
parsing/rejection, determinism + manifest, offline test) with three Gherkin
acceptance scenarios; Phase 1 R0–R4 are marked complete/frozen and the
"Out of scope" section lists only Phase 3+.

## Verification (exact commands + outputs)

### Generator test

```
$ node .pipeline/bin/generate-spec-test.cjs
PASS: valid brief exits 0
PASS: spec file written
PASS: R1 present verbatim (EARS preserved)
PASS: R2 present verbatim (EARS preserved)
PASS: R3 present verbatim (EARS preserved)
PASS: one Gherkin scenario per requirement
PASS: Gherkin expansion is mechanical (When=trigger, Then=behavior)
PASS: Context from What it is + source URL
PASS: Excluded merged into Out of scope
PASS: regeneration exits 0
PASS: regeneration is byte-identical
PASS: manifest maps slug -> brief sha256
PASS: all-briefs mode exits non-zero (malformed present)
PASS: all-briefs mode skips up-to-date brief
PASS: missing-seed brief exits non-zero
PASS: missing-seed error names the brief and the section
PASS: bad-bullet brief exits non-zero
PASS: bad-bullet error names the brief, line number and offending line
PASS: bad-bullet error states the expected WHEN/SHALL shape
PASS: no spec written for rejected briefs

All checks passed.
```

### Scout regression (template change)

```
$ node .pipeline/bin/scout-test.cjs   # 20/20 PASS, incl. updated check:
PASS: (a) brief has 4 structured sections + TODO(agent) fallback
```

### No-LLM proof

```
$ grep -nE "fetch|http|callKimi|pipeline\.cjs|api\." .pipeline/bin/generate-spec.cjs
CLEAN: no LLM/network/API references
```

### Real brief → real spec (acceptance)

Ran the REAL scout against live sources (mock rails accepting on :8013,
`KIMI_API_KEY` unset → template path):

```
$ node .pipeline/bin/scout.cjs
rails: OK
Sources: 8 HN, 5 Reddit, 18 arXiv, 8 GitHub, 0 Twitter, 0 X, 0 Bluesky, 0 Mastodon, 56 blogs
After dedup + relevance filter: 18 items
scout: brief written .pipeline/briefs/osreward-instituting-standardized-evaluation-for-cross-platf.md
scout: announced "OSReward: …" to wih:pipeline-discovery
… 5 briefs, seen.json now holds 5 slug(s)
```

Completed the OSReward brief (arXiv:2607.28609 — VLM judges for
computer-use-agent trajectories; integration surface:
`domains/computer-use`, `packages/computer-use`, rails, `.pipeline`) per the
TODO(agent) workflow, then:

```
$ node .pipeline/bin/generate-spec.cjs .pipeline/briefs/osreward-instituting-standardized-evaluation-for-cross-platf.md
generate-spec: wrote .pipeline/specs/osreward-instituting-standardized-evaluation-for-cross-platf.md (R1..R4 …)
```

The spec (on disk, gitignored runtime artifact per C3) has: Context from the
abstract + source URL, R1–R4 verbatim EARS requirements, Out of scope with
both boilerplate and the brief's two Excluded items, and 4 mechanical Gherkin
scenarios — ready for steering gap-analysis.

## C3 check

```
$ git check-ignore .pipeline/briefs .pipeline/specs .pipeline/seen.json .pipeline/errors.log
.pipeline/briefs
.pipeline/specs
.pipeline/seen.json
.pipeline/errors.log
```
