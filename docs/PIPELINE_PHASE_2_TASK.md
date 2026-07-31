# PHASE 2 TASK — Deterministic brief→spec generator

Phase 1 is reviewed and merged into your branch. Now build Phase 2 from
`.steering/spec.md` ("Out of scope (later phases)" section) — the deterministic
generator. Same workflow rules: update `.steering/checkpoint.md` at checkpoints,
[steering] messages are authoritative, NOTES + sentinel when done, then commit
`git add .pipeline .steering docs && git commit -m "feat(pipeline): deterministic brief-to-spec generator (Phase 2)"`.

## The problem with Phase 1 output

Phase 1 briefs have free-text sections, so a mechanical transform into
requirements would be garbage. Fix this at the source: tighten the brief
format, then generate from structure, not prose.

## Build

1. **Tighten the brief template** in `scout.cjs`: the brief body becomes
   structured fields the generator can parse:
   - `# <title>` + source URL + score line (already there)
   - `## What it is` — one paragraph (unchanged)
   - `## Mechanism` — bulleted facts about how it works internally
   - `## Integration surface` — bulleted candidate touchpoints, each formatted
     `- <repo path or subsystem>: <what would change>`
   - `## Requirements seed` — 2-6 bullets, each a single checkable behavior in
     EARS-ish form: `WHEN <trigger>, THE SYSTEM SHALL <observable behavior>`
   The LLM path (callKimi) and the TODO(agent) fallback both emit this exact
   structure. Update scout-test.cjs fixtures accordingly.
2. **`.pipeline/bin/generate-spec.cjs`** (Node CJS, no LLM calls, built-ins only):
   - Reads a brief path (arg) or all unprocessed briefs in `.pipeline/briefs/`.
   - Parses the structured sections (strict: a brief missing `Requirements seed`
     or with bullets not matching the WHEN/SHALL shape is rejected with a clear
     error naming the brief and the offending line).
   - Emits `.pipeline/specs/<slug>.md` in the OpenSpec-profile layout mirroring
     `.steering/spec.md`: Context (from What it is + source URL), Requirements
     (numbered R1..Rn from the seed bullets, verbatim), Out of scope
     (boilerplate + anything the brief marks as excluded), Acceptance (one
     Gherkin scenario per requirement, mechanically expanded: Given <trigger
     context>, When <trigger>, Then <observable behavior>).
   - Idempotent: regenerating from an unchanged brief overwrites the same spec
     file; a `.pipeline/specs/.generated.json` manifest maps slug → brief hash.
   - Deterministic: same brief in → byte-identical spec out (the test must
     prove this by running twice and diffing).
3. **`.pipeline/bin/generate-spec-test.cjs`**: fixture briefs (valid + two
   malformed) → assert: valid brief produces spec with all seed requirements
   present and EARS form preserved; malformed briefs rejected with the right
   error lines; byte-identical regeneration; manifest updated. PASS/FAIL lines,
   non-zero on FAIL. Must pass: `node .pipeline/bin/generate-spec-test.cjs`.
4. Update `.pipeline/README.md` (phase 2 section) and the scout README example.

## Constraints

- No LLM/API calls anywhere in generate-spec.cjs — grep-proof.
- Keep the Gherkin expansion mechanical; if a seed bullet can't expand, that
  brief is rejected, not improvised.
- No changes to Phase 1 selection logic (the steering ruling stands).

## Acceptance

- Generator tests pass (recorded in NOTES).
- One real brief from `.pipeline/briefs/` (any Phase 1 template brief) converts
  to a spec that the steering reviewer can gap-analyze.
- NOTES with frontmatter + sentinel, then the commit above.
