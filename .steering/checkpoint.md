# Steering checkpoint — session/clerk-js-proxy-0915

- **Goal:** Follow-up to #550. Local clerkJSUrl made clerk-js look for sibling chunks on the auth origin (ChunkLoadError). Load clerk-js from the proxy via net.fetch instead.
- **Verified live:** after asar patch, `Clerk session token received from renderer` twice (`gizzi_io@proton.me`). `/health` 200. No `failed_to_load_clerk_js`.
- **Next:** commit, PR, merge, attest, cleanup.

# Steering checkpoint — ao/useeffect-fixes (2026-09-18)

- **Goal:** Fix confirmed useEffect bugs in the Ink TUI: FuzzyPicker's `[query]`/`[focused]` effects called `onQueryChange`/`onFocus` from stale closures (callbacks deliberately omitted from deps).
- **Just did:** Worktree `allternit-ao-useeffect` on `ao/useeffect-fixes` from origin/main. Found `design-system/FuzzyPicker.tsx` IS a React Compiler artifact (`@ts-nocheck` + `react/compiler-runtime`, one of ~360 in `src/cli/ui/ink-app`) but it is also the only/canonical copy — the whole ink-app tree is checked-in compiler output (last touch: "ci: build script is build-production.js"), no separate source exists. Applied the house ref-mirror pattern (`onQueryChangeRef`/`onFocusRef`, updated in a deps-less effect, called inside the existing `[query]`/`[focused]` effects); removed the now-unneeded exhaustive-deps disables.
- **Next:** typecheck in cmd/gizzi-code, commit, PR, merge, attest, cleanup.

# Steering checkpoint — 2026-09-18 shared-checkout discipline sweep (Eoj-directed, Kimi Code)

- **Goal:** Fix the audit finding — shared checkout was on a detached HEAD, 93 behind `origin/main`, with 21 unmerged stale branches. Make "merge to main" mean it.
- **Just did:** Shared checkout moved to `main` and fast-forwarded to `origin/main` (afc16abe7). Discarded a stray dirty `pnpm-lock.yaml` (generated artifact, 7 lines). Deleted 17 branches merged into origin/main; deleted 18 unmerged stale branches per Eoj: absorb/cowork-team-intelli, ao/gc-engine, ao/gc-setup-card, all 10 cands/session_* WIP-preservation branches, recover-qwen-temp, both salvage/*, session/grok-bot-0-18-integration, chore/remove-vercel (remote too). Added AGENTS.md commandment 6 (proof, not claims) + `scripts/git-discipline-check.sh` session-end gate (lifecycle step 9).
- **Intentionally kept, unmerged (pass these as arguments to git-discipline-check.sh):**
  - `ao/swarm-mirofish` (90 unique commits, 2026-07-17) — Eoj: "needs to be worked out more". Real feature work, not on origin.
  - `ao/p8-d` (1 unique commit, 2026-08-09, Swarm D permission policies) — likely part of the swarm-mirofish effort; kept pending that decision.
  - `session/openmaus-botmode-0915` (5 unique commits, 2026-09-17, checked out in a live worktree) — active session work; needs a merge-or-abandon decision when that session lands.
- **Also still here (not branch issues):** 3 stashes (oldest: WIP on chore/remove-vercel 2026-09-14), 4 session worktrees incl. desktop-full-0915 and jev-real-eval; the janitor sweep of worktrees was NOT part of this task.
- **Next:** DONE 2026-09-18 (same sweep, "wiring only"): `git-discipline-gate.sh` Stop hook wired for kimi/codex/gizzi-code via steer-install.sh + committed `.claude/settings.json`; gate runs the check against the shared checkout at every turn end and blocks on detached/behind/ahead/unmerged-stale (dirty tree = warn only); allowlist moved to committed `.steering/git-discipline-allowlist` (ao/swarm-mirofish, ao/p8-d). Still open: fate of ao/swarm-mirofish + ao/p8-d (PR or delete) and openmaus-botmode-0915.
