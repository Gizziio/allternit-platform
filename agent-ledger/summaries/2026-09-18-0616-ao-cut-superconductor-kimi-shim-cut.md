# Attestation — ao/cut-superconductor (superconductor parallel-run cut)

- **Date:** 2026-09-18 0616
- **Session/branch:** `ao/cut-superconductor` (worktree `allternit-ao-cut-superconductor`)
- **Agent:** kimi-code (subagent shim)
- **PR:** #579 — merge commit `9ebb51bf5`
- **Owner decision (2026-09-18):** CUT, not build. The feature trio is the "advertised-but-stubbed" pattern.

## What was done

Cut the superconductor parallel-run feature from `Gizziio/allternit-platform`:

1. **Verified debris absent:** `packages/@allternit/executor-superconductor-archived/` — not on disk, not in `git ls-files`, no deletion commit in history (it was untracked debris removed from the shared checkout by a prior session, as `.steering/checkpoint.md` records).
2. **Consumer audit (pre-delete):** repo-wide grep for `executor-superconductor`, `SuperconductorExecutor`, `superconductor`, `internal-parallel-executor`, `canvas-event-mapper` (excluding node_modules/dist). Zero package-name consumers of `@allternit/executor-superconductor`. The only caller was the stub CLI's `require('../executor-superconductor/src/superconductor.executor')` — path confirmed absent on disk. `archive/computer-use-operator/ui-tars/src/superconductor-integration.tsx` references a different never-existing name (`@executor-superconductor`), is archived/non-workspace — historical, left as-is. No hits in `.github/workflows`, `pnpm-workspace.yaml`, root `package.json`, or tsconfig path mappings.
3. **Deleted:** `packages/@allternit/executor-superconductor/` (6 files, `git rm -r`) and `cmd/cli-typescript/cli/bin/allternit-parallel.js`.
4. **De-advertised:** removed the `bin` entry + `superconductor` keyword + "Superconductor integration" description from `cmd/cli-typescript/cli/package.json`; removed `'superconductor'` from the `ParallelExecutionBackend` union in `packages/@allternit/executor-core/src/executor.interface.ts` and from `packages/@allternit/parallel-run/src/parallel-run.contract.ts` (plus the `superconductor?:` config block); deleted `surfaces/docs/cli/cli-typescript.mdx` (documented the removed stub bin); removed its `docs.json` nav entry; repointed three "Gizzi Code CLI" links `/cli/cli-typescript` → `/cli/overview`; dropped `executor-superconductor` from the `docs/audit/allternit-audit.md` package list. `packages/@allternit/parallel-run` (local/selfhosted) remains as the separate working mechanism — only the superconductor-specific claims were removed.
5. **Lockfile:** `pnpm install --lockfile-only` (pnpm 10.28.0) — 14 lines deleted, nothing added. Two importer drops: ours, plus a stale `api/kernel/rails-api` importer whose directory was already removed on main in `b0951a5dd`. No dependency churn. Not lock noise; committed deliberately.

## Verification evidence

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** (unchanged from main).
- `pnpm run build` (tsc) in `packages/@allternit/parallel-run` → exit 0.
- `pnpm run build` (tsc) in `packages/@allternit/executor-core` → exit 0.
- `Cargo.toml` grep for superconductor → zero hits (Rust unaffected; cargo not invoked).
- Post-delete repo-wide grep: remaining superconductor hits only under `archive/`, `docs/archive/`, and `.steering/checkpoint.md` (historical / prior-session log).

## Incidents / deferrals

- **Deferred follow-up (reported in PR, not in scope):** `cmd/cli-typescript/cli/src/local-executor.js` is now orphaned (only the deleted bin required it) and the package has no `main` entry — a later pass may cut the whole `cmd/cli-typescript/cli` husk.
- Desktop rebuild (lifecycle step 8) skipped: session touched nothing the desktop bundles.
- `docs/archive/*` superconductor mentions are historical record and intentionally left.
- Worktree `allternit-ao-cut-superconductor` removed, branch `ao/cut-superconductor` deleted local+remote after merge.
