# M4 TASK — brain as a first-class web surface section

You are the executor continuing in this session. `.steering/spec.md` (R1–R4 +
acceptance) is the source of truth. Work in surfaces/ai.allternit.com (and
cmd/allternit-api only for the brains list endpoint if missing).

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] authoritative.
2. Done → `docs/META_M4_NOTES.md` with YAML frontmatter, then
   `touch docs/META_M4_NOTES.sentinel`.
3. Then commit: `git add surfaces cmd .steering docs && git commit -m "feat(surfaces): Brain section — pages, learning feed, fork (M4)"`.
   A gate reviews; fix and retry if blocked.

## Build map

1. FIRST check cmd/allternit-api's D2 brain routes for a list endpoint; if
   absent, add `GET /api/v1/brains` (authenticated user scope) following the
   D2 conventions + a handler test (oneshot precedent).
2. Explore the ai.allternit.com surface structure: its router, nav, API
   client pattern, markdown rendering (if none, minimal safe renderer or
   the existing markdown package — check package.json before adding any dep;
   prefer what the repo already has).
3. Brain section per spec: nav entry, brains list, brain detail (grouped
   pages + badges), Learning Feed view (learnings dir, stale dimming,
   provenance), clone-URL copy, empty state.
4. Tests per the surface's existing setup (vitest? component tests? — find
   and match the narrowest convention): feed dimming, grouping, empty state.
   If the surface has no component-test precedent, cover the data-shaping
   helpers with unit tests and note it in NOTES.
5. Verify with the dev API if reachable (localhost:8013); otherwise document.

## Constraints

- Read-only; no mutations from the surface in this phase.
- No new heavy dependencies; match surface conventions exactly.
