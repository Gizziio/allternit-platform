# S8 — Ratify REPO_STRUCTURE.md after folder reorg S1–S4/S6/S7

**Session:** ao/folder-s8-ratify (S8 of the 2026-09-18 folder reorganization)
**Date:** 2026-09-18 1251
**Agent:** kimi-code
**PR:** #603 merged **b1a63d2a2** (merge commit)
**Base:** 6a3ad035f

## What was done

Docs-only ratification of `REPO_STRUCTURE.md` as the final source of truth for the post-reorg tree. No code, configs, AGENTS.md, README.md, or queue.json touched. Diff: 14 insertions, 3 deletions, one file.

### Doc changes

1. **Final top-level tree regenerated from disk reality** (`ls -d */` + `git ls-tree origin/main`):
   - `cmd/` — added missing `allternit/` and `cli/` entries.
   - `surfaces/` — added missing `computer-embed/`, `gizzi-github-action/`, `gizzi-vscode/`, `phone-remote/`.
   - Added undocumented root dirs `templates/` (system/ VM YAML) and `tmp/` (tracked scratch evidence).
   - `platform/` line now says "Rust SDK"; `platform/packages/` count corrected 38 → **39** (`ls platform/packages/ | wc -l`).
   - Verified `spec/Contracts/` remains a deliberate root exception (read from disk by validate_law.py, context-pack-builder, gateway service).
2. **Ownership rules** — appended the "no new root-level markdown" rule: exactly six sanctioned root docs (README, AGENTS, REPO_STRUCTURE, SECURITY, CHANGELOG, LICENSE) + two live-code exceptions (GIZZI.md, THIRD-PARTY-NOTICES.md); everything else to `docs/`. `scripts/docs-lint.cjs` noted as the docs lint gate — verified on disk; it lints the Mintlify docs site under `surfaces/docs/`, so the root-md rule itself remains review-enforced (stated honestly in the doc).
3. **Three SDKs** — `platform/sdk` → `platform/rust-sdk` note now reads **done (S4, PR #584)**; crates verified on disk: sdk-core, sdk-transport, sdk-policy, sdk-functions, sdk-apps under `platform/rust-sdk/rust/`.
4. **History** — added the "Dissolved roots (2026-09-18 reorg)" line: `api/` → `services/` (S2, PR #595); `packages/@allternit/*` → `platform/packages/*` (S3, PR #597); `platform/sdk` → `platform/rust-sdk` (S4, PR #584). PR titles verified via `gh pr view`.

## Verification evidence

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**.
- ls-vs-doc mechanical check: every tracked root dir listed in the doc (only diffs: LICENSE/Makefile/NOTICE files and the `infra` symlink — the doc documents infra as an alias of `infrastructure/`); every doc-listed dir exists on disk (cmd/ and surfaces/ children individually re-verified).
- Root .md on disk = exactly the sanctioned set (AGENTS, CHANGELOG, GIZZI, README, REPO_STRUCTURE, SECURITY, THIRD-PARTY-NOTICES) + extensionless LICENSE.
- `git grep -n 'api/\|packages/@allternit' REPO_STRUCTURE.md` → only `allternit-api` (real binary) and history/ownership-note hits.
- Note: `packages/@allternit/*` still exists on disk in the shared checkout but contains only git-ignored build debris (node_modules/dist) — sources are gone from git; not a doc concern.

## Incidents

None.

## Deferred / follow-ups

- The root-md rule has no mechanical enforcer (docs-lint.cjs covers the Mintlify docs site only) — a future session could add a root-md guard to CI if wanted.
- docs/README.md taxonomy verified against `ls docs/` — no drift, left untouched.
- AGENTS.md step 8 (desktop rebuild) N/A — docs-only change, nothing the desktop bundles.
