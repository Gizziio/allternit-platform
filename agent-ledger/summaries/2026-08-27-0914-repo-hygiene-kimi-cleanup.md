# Agent Work Attestation — Repo Hygiene & Root-Level Reorganization

**Date:** 2026-08-27 09:14  
**Session ID:** repo-hygiene  
**Branch:** session/repo-hygiene  
**Agent:** kimi  
**Commit:** 3bbbec07c8afa534d34d91dd12c18a30c7c08a20  
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Audited the `allternit` monorepo and performed a hygiene pass focused on removing working-tree noise, improperly-linked nested worktrees, and root-level content drift.

- Removed improperly-linked nested worktrees from the git index:
  - `allternit-session-grok-bot-0-18-integration`
  - `allternit-session-multica-runtime-align`
  - `.tmp-skill-test` tracked files
- Deleted ignored working-tree scratch:
  - `.cache/`, `.references/`, `.pytest_cache/`
  - `.tmp-anthropic-skills-src/`, `.tmp-ui-skills-src/`, `.tmp-skill-test/`
  - `surfaces/allternit-desktop/test-results/`
- Consolidated root-level drift into documented homes:
  - `marketing/` → `docs/marketing/`
  - `upstream/sources.yaml` → `docs/upstream/sources.yaml`
  - `remix-content/` → `docs/learning/remix-content/`
  - `audit-ai-platform.cjs`, `inspect-model-lab.cjs` → `scripts/audit/`
  - `TODO-remote-control-gap-fix.md` → `docs/projects/remote-control-gap-fix/TODO.md`
  - `PORTING_PROVEN_PATTERNS_INTO_GIZZI.md` → `docs/projects/porting-proven-patterns/`
- Updated references in `REPO_STRUCTURE.md`, `tests/vitest.config.ts`, `docs/GENOFFICE_PHASE5_DECISION.md`, `docs/marketing/README.md`, `docs/marketing/templates/*.html`, and `.steering/checkpoint.md`.

## How it works

The changes are purely organizational. No live source code paths (`cmd/`, `services/`, `domains/`, `platform/`, `surfaces/`, `rails/`, etc.) were restructured. The cleanup eliminates the nested-worktree pollution that was breaking `git status` and search, and moves content-only directories under `docs/` and `scripts/` so the root layout matches `REPO_STRUCTURE.md`.

## Verification

- `git worktree list` shows no nested worktrees inside the main checkout.
- `git status --short` shows only the untracked `.parity-reports/allternit-audit.md`.
- `cargo check -p allternit-api` passes (pre-existing warnings only).
- Merged `session/repo-hygiene` into local `main` via fast-forward.

## Known gaps / remaining work

- Historical references in `docs/archive/` and `docs/Future_Blueprints/` still mention old `upstream/` or `marketing/` concepts; they are architectural/historical and were left as-is.
- `.parity-reports/allternit-audit.md` is untracked in the main checkout; decide whether to commit it under `docs/audit/` or keep it as a working artifact.
- No deeper rearchitecture of the live code layout was performed; this was limited to hygiene and root-level consolidation.

## Files changed

- `.steering/checkpoint.md` — added repo-hygiene checkpoint; updated historical TODO path
- `REPO_STRUCTURE.md` — documented new `docs/marketing/`, `docs/upstream/`, `docs/learning/remix-content/`, `docs/projects/` layout
- `tests/vitest.config.ts` — removed obsolete `upstream` exclude entries
- `docs/GENOFFICE_PHASE5_DECISION.md` — updated upstream sources path
- `docs/marketing/README.md` and `docs/marketing/templates/*.html` — updated internal references
- `marketing/` → `docs/marketing/` (rename)
- `remix-content/` → `docs/learning/remix-content/` (rename)
- `upstream/sources.yaml` → `docs/upstream/sources.yaml` (rename)
- `audit-ai-platform.cjs`, `inspect-model-lab.cjs` → `scripts/audit/` (rename)
- `TODO-remote-control-gap-fix.md` → `docs/projects/remote-control-gap-fix/TODO.md` (rename)
- `PORTING_PROVEN_PATTERNS_INTO_GIZZI.md` → `docs/projects/porting-proven-patterns/` (rename)
- Removed from index: `.tmp-skill-test/*`, `allternit-session-grok-bot-0-18-integration`, `allternit-session-multica-runtime-align`
