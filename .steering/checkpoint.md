# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase 1 of the discovery-to-spec pipeline (`.steering/spec.md`, R0–R4): a scout
that ensures rails is writable (`rails-ensure.sh`), fetches discovery sources
via `.github/scripts/lib/pipeline.cjs`, writes mechanism briefs for the top-5
unseen items to `.pipeline/briefs/`, tracks slugs in `seen.json`, and announces
each brief to rails thread `wih:pipeline-discovery`. Hard-abort on any rails
failure; no fallback path.

## Just did

First commit attempt was BLOCKED by the steering gate. Applied both rulings:

1. **R1 selection order** — flipped scout.cjs to dedup-filter-first-then-cap
   (drain backlog): filter items already in `seen.json`, sort by
   `relevance.score`, take top 5. No more score-window starvation of rank-6+
   items.
2. **spec.md fixes** — rewrote the self-contradictory Gherkin scenario to
   "a re-run drains the backlog without duplicating" (remaining 3 briefed on
   re-run, no duplicates, third run no-op); fixed P1 prose to state the debug
   binary is a build prerequisite (`cargo build --bin allternit-api` if
   missing), not asserted prebuilt.
3. **scout-test.cjs scenario (b)** reworked to drain semantics + a third-run
   no-op check. Full suite re-run: **20/20 PASS**.
4. NOTES + README updated to match.

## Next

Retry the gated commit: `git add .pipeline .steering docs Makefile && git
commit -m "feat(pipeline): rails-ensure + discovery scout (Phase 1)"`.
Sentinel `docs/PIPELINE_PHASE_1_NOTES.sentinel` is in place.

## Open questions

- (none — both prior questions ruled by steering)
