# Steering checkpoint — session/clerk-js-proxy-0915

- **Goal:** Follow-up to #550. Local clerkJSUrl made clerk-js look for sibling chunks on the auth origin (ChunkLoadError). Load clerk-js from the proxy via net.fetch instead.
- **Verified live:** after asar patch, `Clerk session token received from renderer` twice (`gizzi_io@proton.me`). `/health` 200. No `failed_to_load_clerk_js`.
- **Next:** commit, PR, merge, attest, cleanup.

# Steering checkpoint — 2026-09-18 shared-checkout discipline sweep (Eoj-directed, Kimi Code)

- **Goal:** Fix the audit finding — shared checkout was on a detached HEAD, 93 behind `origin/main`, with 21 unmerged stale branches. Make "merge to main" mean it.
- **Just did:** Shared checkout moved to `main` and fast-forwarded to `origin/main` (afc16abe7). Discarded a stray dirty `pnpm-lock.yaml` (generated artifact, 7 lines). Deleted 17 branches merged into origin/main; deleted 18 unmerged stale branches per Eoj: absorb/cowork-team-intelli, ao/gc-engine, ao/gc-setup-card, all 10 cands/session_* WIP-preservation branches, recover-qwen-temp, both salvage/*, session/grok-bot-0-18-integration, chore/remove-vercel (remote too). Added AGENTS.md commandment 6 (proof, not claims) + `scripts/git-discipline-check.sh` session-end gate (lifecycle step 9).
- **Intentionally kept, unmerged (pass these as arguments to git-discipline-check.sh):**
  - `ao/swarm-mirofish` (90 unique commits, 2026-07-17) — Eoj: "needs to be worked out more". Real feature work, not on origin.
  - `ao/p8-d` (1 unique commit, 2026-08-09, Swarm D permission policies) — likely part of the swarm-mirofish effort; kept pending that decision.
  - `session/openmaus-botmode-0915` (5 unique commits, 2026-09-17, checked out in a live worktree) — active session work; needs a merge-or-abandon decision when that session lands.
- **Also still here (not branch issues):** 3 stashes (oldest: WIP on chore/remove-vercel 2026-09-14), 4 session worktrees incl. desktop-full-0915 and jev-real-eval; the janitor sweep of worktrees was NOT part of this task.
- **Next:** Wire `git-discipline-check.sh` into the session Stop hook so a session cannot claim "done" while the check fails (tracked follow-up, not yet wired). Decide fate of ao/swarm-mirofish + ao/p8-d (PR or delete) and openmaus-botmode-0915.
