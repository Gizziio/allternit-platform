# Checkpoint — artdecisions-0912

## Goal
Record Eoj's 7 Artifacts API decisions into docs/design/artifacts-api.md (§6 publish tier x4, §6 relay tier x2, §8 version retention x1), unblock Phase 3, comment on issues 386/387/388/389. Docs-only session — no desktop rebuild.

## Just did
- Fetched origin/main, created worktree allternit-session-artdecisions-0912 on branch session/artdecisions-0912.
- Read docs/design/artifacts-api.md fully (346 lines).
- Recorded all 7 decisions: §6 publish tier (shared project/per-user routes, version snapshot, immutable deployments/route-only unpublish, sandbox-policy publish gate), §6 relay tier (mint local id + origin in provenance, standard sandbox for received), §8 retention (cap 50, admin-configurable, prune oldest). Updated §7 Phase 2/Phase 3 notes and the header status line. OPEN lists rewritten as answered decisions, dated 2026-09-12 / Eoj.

## Next
Markdown consistency verified by re-reading edited sections. Commit, push, PR, merge (--merge). Then issue comments (386 epic, 389, 387, 388), ledger branch, cleanup.

## Open questions
None — all 7 decisions supplied by owner in session spec.
