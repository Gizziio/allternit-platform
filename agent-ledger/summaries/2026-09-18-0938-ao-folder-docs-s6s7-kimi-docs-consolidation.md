# Folder reorganization waves S6 + S7 — docs consolidation

**Session:** ao/folder-docs-s6s7 (S7, PR #585) + ao/folder-docs-s6 (S6, PR #587)
**Agent:** kimi-code subagent (orchestrated wave executor)
**Date:** 2026-09-18

## What was done

Mechanical documentation consolidation per the S0 design (PR #582), executed strictly in a linked worktree (`allternit-ao-docs67`), `git mv` only.

**S7 (PR #585, merged `72c34651d`) — docs/ internal reorg:**
- 369 git mv: 323 loose ALL-CAPS docs at `docs/` depth 1 + 46 `.sentinel` sidecars filed into `docs/programs/{swarm,rails,gizzi,ios,cloud-agents,ao,acu,media-plugins}/` by filename prefix (156 entries) and `docs/learnings/` for non-prefixed orphans (214 entries, incl. `CROSS_REFERENCE_REPORT.py` + `PROGRAM_ARTIFACT.html`).
- Kept at depth 1: `MASTER_INDEX.md`, `NATIVE_SESSIONS.md`, `AGENT_EMAIL_RAIL.md` (the latter two are path-frozen from root AGENTS.md).
- Refreshed `docs/MASTER_INDEX.md` (format kept, refresh date noted; dropped the stale `MASTER_HANDOFF_PROMPT.md` pointer — that file does not exist on main) and added `docs/README.md` with the taxonomy + the agent-ledger rule (signed record outside docs/, linked never copied).
- Link sweep: 362 line fixes across 204 `.md` files (`docs/<FILE>` → new home), incl. a 2-line path fix inside root `AGENTS.md` itself.

**S6 (PR #587, merged `ec868882e`) — root collapse:**
- `reports/` (4) → `docs/reports/`; `research/` (18 entries incl. 3 subdirs) → `docs/research/`; `spec/` → `docs/specs/` (`MEMORY_FABRIC_SPEC.md`, `provider-routing/`, `design/`, `python-heavy-agents/`).
- `MASTER_TRACKING.md` → `docs/projects/allternit-cloud/`; `ALLTERNIT_CLOUD_HANDOFF_COMPLETE.md` + `ALLTERNIT_CLOUD_DONOR_HANDOFF.md` → `docs/projects/allternit-cloud/handoffs/`; `DESIGN.md` → `docs/design/`; `AGENT_CREATION_CHECKLIST.md` → `docs/`; `ANTHROPIC_TO_ALABS_MAPPING.md` → `docs/learnings/`.
- `commrails/README.md:37` known-dead link (`spec/agent-system-rails/…`, never existed in repo) repointed at `commrails/spec/SPEC_OVERVIEW.md` (verified on disk).
- Link sweep ~20 files: AGENTS.md checklist path, README.md, REPO_STRUCTURE.md tree + history note, MASTER_INDEX counts, report cross-references, typography paths, `.agents` skill path, `.steering` plan paths, desktop AUDIT.md.

## Deliberate exceptions (load-bearing root items — moving them requires code/config edits, out of bounds for a docs-only wave)

- `spec/Contracts/` — read from disk by `scripts/validate_law.py`, `dev/scripts/validate_law.py`, `domains/kernel/drivers/context-pack-builder/src/lib.rs`, `services/gateway/service/src/main.py`.
- `GIZZI.md` — workspace-instruction file loaded from cwd by allternit-api (`INSTRUCTIONS_FILES`) and gizzi-code; this repo's root is every session's workspace.
- `THIRD-PARTY-NOTICES.md` — electron-builder `extraFiles` copies it from repo root into the desktop release bundle.

All three are documented in `REPO_STRUCTURE.md` (tree + 2026-09-18 history note) and `docs/README.md`.

## Verification

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed** on both PRs.
- Every `git mv` destination verified on disk.
- Old-path reference sweeps: zero remaining old-path refs outside intentional exclusions. Stale references intentionally left:
  - S7: 33 in `agent-ledger/` historical summaries (dated records), 2 in `cmd/gizzi-code/AGENTS.md` (no-touch zone), plus non-functional doc-pointer comments in `.rs`/`.ts`/`.py` (out of scope for a docs-only wave; suggested follow-up).
  - S6: `.github/workflows/secrets.yml` comment (no-touch), `cmd/gizzi-code/AGENTS.md` checklist link (no-touch), `archive/` records referencing never-existing files (pre-existing stale), donor-machine absolute paths inside the handoff docs (historical record).
- `bash scripts/git-discipline-check.sh` → PASS (on main == origin/main `ec868882e`, 10 branches, 0 unmerged outside allowlist, clean tree).

## Deviations from the wave spec (flagged in both PR bodies)

1. `GIZZI.md` and `THIRD-PARTY-NOTICES.md` remain at root (spec required root to end with exactly 6 entries) — both are read from repo root by live code; the spec's own "never touch code/config" rule takes precedence. Root `ls *.md` = 5 sanctioned + 2 flagged exceptions.
2. `spec/Contracts/` (49 schema files) remains at root for the same reason (task estimated "~2 files" in `spec/`; actual contents were larger).
3. Root `AGENTS.md` received link-only path fixes in both PRs (2 lines S7, 1 line S6) — the S6 spec explicitly instructed the AGENT_CREATION_CHECKLIST path update; leaving the S7 RAILS_PRODUCT_UPDATE reference stale would have contradicted the "fix every hit" rule.

## Follow-ups worth doing (not done here)

- Sweep code-comment doc pointers (`docs/X.md` strings in `.rs`/`.ts`/`.py` comments) to the new paths — cosmetic, ~25 hits across cmd/allternit-api, infrastructure/executor, domains/computer-use, packages, scripts.
- `docs/RAILS_UNIFIED_COMMUNICATION_PLAN.md` is referenced by AGENTS.md but does not exist on main (pre-existing stale reference, unrelated to these moves).
- Worktree + branch cleanup: `allternit-ao-docs67`, `ao/folder-docs-s6s7`, `ao/folder-docs-s6`.
