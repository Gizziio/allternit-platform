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

# Steering checkpoint — 2026-09-18 shim/dead-code Wave 1 (worktree allternit-ao-shimwave1, branch ao/shim-wave1)

- **Goal:** Wave 1 deletions scoped by a prior pass: rails/src dead sketch, api/kernel/rails-api prototype, dangling ui symlink, tests/acceptance/test_ui_*.sh, commrails/compat one-release alias crate. Vendored beads dir + executor-superconductor-archived were untracked debris (shared checkout only) — removed there, no git action needed.
- **Just did:** All verifications passed — rails/src has zero real consumers (`use rails::RailsState` in allternit-api lib.rs is the local `mod rails`, not this crate; other rails/src hits are comments/openai-audit JSONs); rails-api zero refs outside api/README.md; ui symlink target gone from repo, sole `ui/` import hit is page-agent's own packages dir; test_ui zero CI refs, apps/ absent; allternit-agent-system-rails zero real code uses. Executed all `git rm`s + Cargo.toml dep/member removals + REPO_STRUCTURE/api README/.gitignore fixes.
- **Next:** cargo check --workspace (running, shared target), release-preflight (52/0 OK), 5 logical commits, push, PR, merge, discipline check.
- **Open questions:** commrails/docs + cmd/gizzi-code docs still mention the old crate name as history — left as historical context. Historical comment in locked .github/workflows/release-desktop.yml:162 left untouched.

- **Next:** Wire `git-discipline-check.sh` into the session Stop hook so a session cannot claim "done" while the check fails (tracked follow-up, not yet wired). Decide fate of ao/swarm-mirofish + ao/p8-d (PR or delete) and openmaus-botmode-0915.

# Steering checkpoint — session/jev-kimi-head (2026-09-18, Kimi Code subagent)

- **Goal:** Implement KimiCliHead (cloud-iteration tier) for the shadow-head eval harness behind the DecisionHead protocol; run the real eval batched + sequential; honest numbers in docs/JEV_KIMI_HEAD_NOTES.md. No PR — orchestrator handles merge.
- **Just did:** KimiCliHead in core/decision_head.py (subprocess `kimi -p`, strict JSON contract + one repair retry, canonical 11-op vocabulary with alias folding + vocab-miss metric, confidence-scalar → chosen-gets-confidence/uniform-remainder probabilities, batched + sequential questioning). `--head kimi` + `--questioning {batched,sequential}` in scripts/shadow_head_eval.py. step_budget_ms + progress + vocab-miss plumbing in core/shadow_eval.py. 15 new unit tests (stubbed subprocess, no real CLI); targeted suite 66 passed, 1 skipped (mlx weights). `kimi -p` sanity check passed (auth works in this env).
- **Next:** full eval batched (66 steps, ~30 min background) then sequential; write NOTES; commit + push; report numbers.
- **Open questions:** none.
- **Done (2026-09-18 later):** Full evals complete. Batched: agreement 0.3182 (21/66), op 0.7576, target 0.42, 1 vocab miss, 27.9s/step, ~31 min. Sequential: identical agreement, 0 misses, 58.2s/step, ~64 min. Confidence flat (0.94 agree vs 0.94 disagree) — no veto signal. Head collapses to per-task constant policy (task-conditioned, not step-conditioned). docs/JEV_KIMI_HEAD_NOTES.md written. Reports + note-fix committed and pushed. NO PR per orchestrator.
