# Session Summary — ao/folder-docs-s0s1

- **Date:** 2026-09-18 0841
- **Branch:** `ao/folder-docs-s0s1`
- **PR:** #582, merge commit `88f4bfebf` (merge commit, not squash)
- **Agent family:** kimi-code (subagent of the folder-reorganization orchestration)

## What was done

First three commits of the adopted folder-reorganization plan ("S0", "S1", orphaned-husk cut). All work in the linked worktree `allternit-ao-foldocs`; shared checkout untouched until the post-merge fast-forward.

### Commit 1 — `72695b148` docs(repo): S0 truth pass on REPO_STRUCTURE.md and README.md

- **REPO_STRUCTURE.md** (kept existing structure/format; correction pass):
  - Removed the `surfaces/ai.allternit.com` reference from the `.allternit/` runtime-state table and added an explicit note that the workspace surface moved to the private satellite `Gizziio/allternit-ai` in the 2026-09-15 OSS split, and that `rails/` + the root `ui` symlink were deleted (real substrate: `commrails/`). (No `rails/` entry or numeric package count existed in REPO_STRUCTURE — those drifts were in README.)
  - Updated stale listings: `cmd/` (13 entries, matches post-PR disk), `surfaces/` (added allternit-docs, office.allternit.com, platform.allternit.com), `mcp/` (now mentions computers-server).
  - Added undocumented root dirs: `vendor/` (harnessrouter-ce, session-migrate) and `agent-ledger/` (signed session record; stays at root by design). `worktree-manager/` was already listed.
  - Corrected `packages/@allternit/` count to **38** (actual dirs today, post executor-superconductor cut).
  - Added the adopted **Ownership rules** section (now the source of truth): `cmd/` = executables; `services/` = things that run; `platform/` = contracts, protocols, types, plugins, internal `@allternit/*` TS libraries; `sdk/` = public SDK surface only (location frozen); `domains/`, `infrastructure/`, `surfaces/` keep existing semantics. Also noted `packages/@allternit/` → `platform/` consolidation and `api/` → `services/` dissolution.
  - Added **Three SDKs** note: `sdk/` (public TS, tag `sdk/v*`), `platform/sdk/rust/` (Rust; rename to `platform/rust-sdk/` is planned and deliberately NOT in this PR), `cmd/gizzi-code/packages/sdk/` (tag `gizzi-sdk/v*`). Both tag patterns confirmed to exist (`sdk/v1.3.0`, `gizzi-sdk/v1.3.2`).
- **README.md**: full replacement (obsolete `0-substrate/…6-ui/` ASCII layout, `cargo build -p rails`, nonexistent `./install.sh`, dead `pnpm dev:platform` scripts). New 80-line README: what the repo is, ownership-rule summary, links (REPO_STRUCTURE.md, AGENTS.md, docs/), and quickstart verified against root `package.json`/`Makefile`: `pnpm install`, `cargo build -p allternit-api`, `make api` / `pnpm dev:api`, `pnpm dev`, `pnpm tui`.

### Commit 2 — `c05107952` chore(api): cut dead cmd/cloud-backend duplicate stub

- Deleted `cmd/cloud-backend/` (3 files). **Plan said "empty stub, no src/" — that was wrong**: it had a 380-line `src/index.ts`. Re-verified instead: it is a *stale fork* of the live `api/core/cloud-backend/src/index.ts` (diff = missing `auth.ts` import, TODO accept-any-token auth vs real `validateAuthToken`, no tests dir, looser types) under a different package name (`@allternit/cloud-backend-service` vs `@allternit/cloud-backend`).
- Stop-condition check: repo-wide grep for `cmd/cloud-backend` (json/yml/toml) and `cloud-backend-service` (json/ts/js/mjs) found **zero consumers**. The `surfaces/docs` docs.json hits (`tools/cloud-backend`, `byoc/cloud-backend`) are docs-site nav pages about the live cloud backend, not consumers. Deletion proceeded; discrepancy reported in PR body.
- Replaced `api/README.md` with the short dissolution pointer (remaining live: gateway/routing, services/workspace-service, core/cloud-backend, services/ssh-bridge, services/replies-runtime — verified against `ls api/`).
- `pnpm-workspace.yaml`: verified — only `cmd/*` globs, no explicit reference; no edit.
- Lockfile: `pnpm install --lockfile-only` → diff is exactly the `cmd/cloud-backend` importer block (25 lines). No churn.

### Commit 3 — `82f668d77` chore(cli): cut orphaned cmd/cli-typescript/cli husk

- Deleted `cmd/cli-typescript/cli/` (package.json + src/local-executor.js). Pre-delete checks: no `main`/`bin` in package.json; repo-wide grep for `cli-typescript/cli` and `local-executor` outside the package found **zero consumers**; its dep `@allternit/runtime` resolves to the live `services/runtime/adapter/allternit-runtime`, so nothing else is stranded.
- `cmd/cli-typescript/` had no parent package.json and no other tracked files → husk removal takes the whole `cli-typescript` tree (directory now absent).
- `pnpm-workspace.yaml`: `cmd/*`/`cmd/*/*` globs only; no edit needed.
- Lockfile: importer drop only (`cmd/cli-typescript/cli`, 9 lines). This clears the deferral left by session `ao/cut-superconductor` (PR #579 ledger entry: "Deferred: cli-typescript husk … for a later pass").

S2 moves (`api/` packages → `services/`) deliberately **not** performed — pointer only.

## Verification evidence

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**, run on clean baseline AND after all three commits. No release-path files touched (no changes under surfaces/allternit-desktop, services/voice, services/local-engine, .github/workflows/release-desktop.yml, cmd/gizzi-code/script/build-production.js, scripts/release-preflight.mjs).
- No `Cargo.toml`/`Cargo.lock` touched (`git diff --name-only origin/main...HEAD | grep -i cargo` → empty), so `cargo metadata` check not required.
- Lockfile diffs after each deletion: importer drops only (25 + 9 lines), zero other churn.
- REPO_STRUCTURE cross-check: all 29 listed root dirs exist on disk; post-PR `cmd/` listing (13 entries) matches the doc.
- Shared checkout synced: `git pull --ff-only` → now at `88f4bfebf` (merge of #582; also picked up a concurrent shadow-eval commit from another session — no conflict).

## Contradictions found vs the plan (did NOT block; reported)

1. `cmd/cloud-backend/` was **not** "package.json + tsconfig only, no src/" — it contained a full near-copy of the live cloud-backend server. The plan's stop condition was a REAL CONSUMER; none exists, and the directory is a strictly-less-capable stale duplicate, so the cut proceeded with the discrepancy documented in the PR body.
2. Plan asked to check `cmd/cli-typescript/package.json` workspaces globs — the file does not exist (parent dir had no manifest); nothing to fix.
3. `worktree-manager/` was listed in REPO_STRUCTURE already; only `vendor/` and the `mcp/` description needed adding.

## Deferrals / follow-ups

- S2: perform the `api/` → `services/` moves (gateway/routing, services/*, core/cloud-backend) — now pointer-documented.
- `platform/sdk/` → `platform/rust-sdk/` rename — planned, intentionally not in this PR.
- Desktop rebuild (lifecycle step 8): not needed — nothing the desktop bundles was touched.
- Worktree `allternit-ao-foldocs` removed and branch deleted after this attestation.
