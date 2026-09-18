# S2: dissolve api/ root into services/ — session summary

**Session:** ao/folder-s2-api-dissolve (worktree `allternit-ao-s2-apimove`)
**Agent:** kimi-code subagent (step S2 of the platform folder reorganization)
**Date:** 2026-09-18 11:35 local
**PR:** #595 — merged as `2ee8ccb061b7a17e899b075e8df0c970ec22056c` (merge commit)

## What was done

Moved the 4 remaining packages out of the dissolving `api/` root per the ownership rule established in PR #582 (`cmd/` = executables, `services/` = things that run, `api/` ceases to exist). The relay cut (PR #590) had already removed `api/core/cloud-backend`; this step finishes the job and deletes the emptied `api/` root.

Moves (git mv, rename detection preserved history):

1. `api/gateway/routing` → `services/gateway/routing` (Rust crate `allternit-tools-gateway`; Rust crate nested inside the existing TS `services/gateway/` family, per design)
2. `api/services/workspace-service` → `services/workspace-service` (Rust crate `allternit-workspace-service`)
3. `api/services/ssh-bridge` → `services/ssh-bridge` (TS)
4. `api/services/replies-runtime` → `services/replies-runtime` (TS)
5. Deleted emptied `api/` root including `api/README.md` (dissolution pointer — the step it described is complete)

Config changes:

- Root `Cargo.toml`: workspace members + `[workspace.dependencies]` paths repointed (lines for `allternit-workspace-service`, `allternit-tools-gateway`). No crate used a direct `path = "api/..."` dep outside workspace deps.
- `pnpm-workspace.yaml`: removed `api/*`, `api/*/*`, `api/*/*/*` globs — both moved TS packages are covered by the existing `services/*` glob at their new depth.
- `pnpm-lock.yaml`: surgical 2-key importer rename (`api/services/replies-runtime` → `services/replies-runtime`, `api/services/ssh-bridge` → `services/ssh-bridge`). A naive `pnpm install --lockfile-only` produced unrelated `@babel/core` 7→8 re-resolution churn (160 ins / 50 del); reverted and hand-edited to keep the diff minimal. `pnpm install --lockfile-only --frozen-lockfile` exit 0 confirms consistency.
- `REPO_STRUCTURE.md`: `api/` tree entry folded into `services/` entry; ownership-rule note records the dissolution as done (2026-09-18, S2).
- `services/gateway/routing/spec/ARCHITECTURE.md`: 2 self-references repointed.
- Stale live-doc path refs fixed: `surfaces/docs/tools/gateway.mdx` (`cd api/gateway/routing` → `cd services/gateway/routing`), `surfaces/allternit-mobile/docs/ios_architecture_plan.md` (3 refs), 2 Swift doc comments in `Reply.swift` / `ArtifactContentLoader.swift`.

## How it works

Nothing behavioral changed — pure relocation. `replies-runtime` tsconfig `paths` use `../../../packages/@allternit/replies-*`; both old and new locations are exactly 2 levels deep, so the relative paths resolve unchanged (verified: both target files exist, typecheck passes from the new location).

## Verification evidence

- `cargo metadata --no-deps --format-version 1` — exit 0 (run again post-rebase)
- `cargo check -p allternit-tools-gateway -p allternit-workspace-service` (shared `CARGO_TARGET_DIR`) — exit 0, 22s, 3 pre-existing lib warnings
- Reverse dependents via metadata: 9 crates depend on `allternit-tools-gateway` via `{ workspace = true }` (workflows, skills, registry, rlm, evals, embodiment, kernel-compat, control-plane, artifact-registry) — none carry direct paths; metadata resolution covers them
- `pnpm install --lockfile-only --frozen-lockfile` — exit 0
- `tsc --noEmit` — passes for both moved TS packages after full `pnpm install` in the worktree
- `node scripts/release-preflight.mjs` — 52 passed, 0 failed
- Workflow sweep — zero true `api/` refs in `.github/workflows/` (2 comment-only mentions: `release-desktop.yml:264` historical comment, `visual-verification.yml:270` Datadog URL in comment)
- Final grep sweep — zero true path hits outside `docs/` historical records, `cmd/gizzi-code/docs/GIZZI_DOCS_PARITY.md` (protected path, descriptive note), and external-API false positives (`/api/services` Home Assistant / Workiom HTTP paths)

## Incidents / notes

- Both TS typechecks initially failed in the worktree due to a *filtered* `pnpm install` not linking workspace sibling symlinks (`replies-reducer → replies-contract`) and hoisted deps — environmental, not code breakage. A/B confirmed against the shared checkout at the old path (typecheck exit 0 there), then both pass at the new path after a full install.
- Shared checkout held untracked stale build artifacts under the old `api/` (`api/core/cloud-backend/dist`, `node_modules` in cloud-backend / replies-runtime / kernel/rails-api) left over from before the relay cut. Removed with the rest of `api/` after the merge — reproducible outputs of deleted packages, git-clean confirmed.
- `docs/` historical records (audits, SPEC files, IMPLEMENTATION_DAG, cross-reference reports) still mention old `api/` paths by design — they are point-in-time documents; excluded from the sweep per the S2 brief.

## Deferred / honest state

- Nothing deferred. All S2 verification gates passed; the api/ root no longer exists anywhere (worktree, origin/main, shared checkout).
