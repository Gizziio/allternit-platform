# Attestation — CI fix: remove committed node_modules symlinks

- **Session:** 2391eb48 (kimi-code)
- **Date:** 2026-09-08
- **Branch:** `session/ci-health`, merged to main via **PR #127** → e1a343692
- **Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Removed two accidentally committed `node_modules` entries that were **symlinks to absolute paths on the authoring machine**:

- `surfaces/ai.allternit.com/node_modules` → `/Users/joe/altw/allternit/surfaces/ai.allternit.com/node_modules`
- `surfaces/node_modules` → `/Users/joe/altw/allternit/surfaces/node_modules`

Root cause: commit 0fb2b990a ('bots: Phase 5 polish', merged via ecb197821) committed the symlinks; `.gitignore`'s `node_modules/` (trailing slash) only matches directories, while a symlink is a git blob of mode 120000 and slips through. On CI, `actions/checkout` materializes dangling symlinks and pnpm 10.28.0's isolated linker fails with `ENOENT ... mkdir '.../node_modules'` at `symlinkDirectRootDependency` — this failed every `deploy-cloudflare-pages.yml` run from 2026-09-07 15:12 UTC (8+ consecutive failures on main). Evidence it was not a lockfile problem: lockfile, pnpm-workspace.yaml, and all package.jsons were identical between the last passing run (9d26a62d3, 15:09 UTC) and the first failing run (ecb197821, 15:12 UTC); those commits differ only in bot sources plus the two symlinks. Verified with `git ls-tree -r` that no other `node_modules` paths are tracked.

## How it works

Pure deletion of the two symlink blobs — no code change. After removal, `pnpm install` creates real `node_modules` directories on CI instead of tripping over dangling symlinks.

## Verification evidence (from PR #127 body)

- Clean worktree from origin/main with symlinks removed: `pnpm install --frozen-lockfile --ignore-scripts` with pnpm 10.28.0 (exact CI version via corepack) exits 0 in ~53s, links 4818 packages, creates a real `surfaces/ai.allternit.com/node_modules` directory.
- Pre-existing non-fatal 'Failed to create bin ... dak' warnings unchanged vs historical passing runs.

## Incidents

- **Symlink recurrence risk remains open**: `.gitignore:1` still reads `node_modules/` (trailing slash), so a stray symlink can be committed again. The PR's suggested follow-up — adding bare `node_modules` (no trailing slash) — has NOT been applied as of this attestation.
- The workflow's remaining typecheck/test failures (e.g. model-picker `UsageSummary.planLabel` in the ai.allternit.com job) are pre-existing and unrelated to this PR.

## Honest deferrals

- Shared-checkout main sync + ledger attestation was deferred by the original session (shared checkout was dirty); this entry closes that gap from a linked worktree per the AGENTS.md step-7 PR route.
- `.gitignore` hardening (`node_modules` without trailing slash) left as a follow-up.
