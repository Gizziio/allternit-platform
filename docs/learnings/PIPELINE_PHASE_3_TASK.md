# PHASE 3 TASK — Spec-checker loop + queue + memory lessons

Phases 1 and 2 are reviewed and approved. Build Phase 3 from `.steering/spec.md`:
the independent spec-checker, the queue, and memory ingestion of rejection
patterns. Same workflow rules: checkpoint updates, [steering] is authoritative,
NOTES + sentinel, then commit
`git add .pipeline .steering docs && git commit -m "feat(pipeline): spec-checker loop + queue + memory lessons (Phase 3)"`.

## Build

1. **`docs/pipeline/spec-rubric.md`** — the spec-checker's review prompt, modeled on
   `.steering/prompt.md` but aimed at specs, not code: every requirement
   verdict-able as DONE/PARTIAL/MISSING by a future builder (no vibe-shaped
   requirements); acceptance scenarios actually prove their requirement;
   right-sized (one reviewable unit, not a disguised epic); no conflict with
   `.steering/spec.md`'s phase boundaries. Verdict contract: first line exactly
   `READY` or `NEEDS-WORK`, then findings citing requirement IDs.
2. **`docs/pipeline/bin/check-spec.sh`** (bash, `set -uo pipefail`):
   - Runs `rails-ensure.sh` first; aborts non-zero if it fails.
   - For each `docs/pipeline/specs/*.md` without a READY verdict in
     `docs/pipeline/verdicts.json` (gitignored):
     a. Assemble request: `spec-rubric.md` + the spec file.
     b. Consult via the env var `SPEC_CHECK_CMD` if set (test hook), else
        `ao-consult` (the ao-steer session — it is the independent reviewer;
        different model family than the pipeline operator).
     c. First line `READY`: move spec to `docs/pipeline/queue/<slug>.md`, record
        verdict, announce to `wih:pipeline-queue` via rails share
        (asset_ref = queue path). Announcement failure = hard error (spec C3/R4
        semantics: rails has no fallback).
     d. First line `NEEDS-WORK`: record verdict + round count, leave the spec in
        place, and append the findings to `docs/pipeline/specs/<slug>.review.md`.
        Max 3 consult rounds per spec; after that mark it `STALLED` in
        verdicts.json and skip it in future runs.
     e. When a spec reaches its 2nd NEEDS-WORK: ingest the rejection pattern to
        memory — `POST http://localhost:3201/api/ingest` with
        `{"content":"<spec slug> + the cited findings","source":"pipeline-spec-checker"}`.
        If memory is unreachable: log to `docs/pipeline/errors.log` and continue
        (lessons are advisory; rails is the only hard dependency).
   - Empty consult answer or transport failure: record nothing, continue to the
     next spec (fail open per-spec, never wedge the run).
3. **`docs/pipeline/bin/check-spec-test.sh`**: with `SPEC_CHECK_CMD` stubbed to cat
   canned verdict files, verify: READY moves + announces + records;
   NEEDS-WORK writes `.review.md` and increments round; 3rd NEEDS-WORK marks
   STALLED and skips afterwards; 2nd NEEDS-WORK triggers the memory POST
   (stub curl via a function or a PATH-shimmed curl that captures); rails
   announce capture like scout-test. PASS/FAIL lines, non-zero on FAIL.
4. Update `docs/pipeline/README.md` — Phase 3 section + the full pipeline diagram
   (discover → brief → generate → check → queue) and the one-line command to
   run a full cycle.

## Constraints

- The checker consult is the ONLY LLM step; everything else is bash/jq-free
  (python3 for JSON if needed, like `.steering/bin/` does).
- Do not modify generate-spec.cjs or scout.cjs behavior except bug fixes
  explicitly noted in NOTES.
- Verdict parsing must be tolerant of the ao-consult bullet prefix (`• `) like
  `.steering/bin/steer-common.sh` does.

## Acceptance

- `bash docs/pipeline/bin/check-spec-test.sh` passes (recorded in NOTES).
- One real run against `docs/pipeline/specs/` content (from Phase 2's real briefs)
  with the live ao-steer, recording the verdict in NOTES.
- NOTES with frontmatter + sentinel, then the commit above.
