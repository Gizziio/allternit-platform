# M3 TASK — learnings persist in the second brain

You are the executor continuing in this session. M1 (event capture +
reflection playbook) is reviewed, approved, merged — your previous work.
`.steering/spec.md` (R1–R4 + acceptance) is the source of truth. Same
workflow: checkpoints, [steering] authoritative, NOTES + sentinel, then
`git add .pipeline .steering docs && git commit -m "feat(pipeline): learnings persist in the second brain (M3)"`.

## Build map

1. Extend learn-reflect.sh (M1): after playbook.md update, persist each new
   rule as brain/learnings/<slug>.md (slug from rule title). Reuse the
   brain resolution logic — extract it from taste-ingest.sh into a shared
   helper if duplication exceeds a few lines (.pipeline/bin/brain-resolve.sh)
   and convert taste-ingest/wiki-ingest to it.
2. Stale flipping: track last_confirmed per rule (playbook frontmatter);
   on each run, rules unconfirmed 90+ days get status: stale in their page.
3. One git commit per reflection run in the brain (message `learn: <n> rules
   (<date>)` or the first slug); never push.
4. Tests (extend learn-test.sh): brain dir fixture (git init) — pages written
   with valid frontmatter + provenance, single learn: commit, stale flip on
   aged rule, no-brain skip logs once and playbook still updates.
5. Keep all M1 tests green.

## Constraints

- Brain is written ONLY under learnings/; never touch other brain content.
- No push, no remote mutation. Memory/memory-service stays advisory.
