# Plan — session/artifactsapi-0911 (A:// Artifacts API design, mapping doc §2 row 16)

## Goal
DESIGN BEFORE BUILD — produce the design doc for the A:// Artifacts API and its
tracking issues. No implementation. Voice Register 1; DECIDED vs OPEN marked.
Mapping doc §2 row 16, Eoj amendment 2026-09-11 (viewer-pays AI artifacts OUT).

## Deliverables
- [x] `docs/design/artifacts-api.md` — 8 sections: goals/non-goals, data model,
      API shape (real JSON), storage (V146+, allternit.db), surfaces (bounded),
      sharing tiers (publish/relay OPEN), phasing (3 sessions), risks/honesty.
- [x] GitHub epic "A:// Artifacts API (Phase 2 program)" linking the doc + one
      issue per phase (enhancement label).
- [x] `.steering/checkpoint.md` update.
- [x] Commit `docs(artifacts-api): …`, push, PR, merge `--merge`.
- [x] Ledger branch `session/ledger-artifactsapi-0911`: dated summary +
      LEDGER.md bullet, PR, merge.
- [x] Cleanup: worktree remove, delete session + ledger branches local+remote.

## Verify
Doc renders (markdown), every code claim cross-checked against the cited path;
gh issue/PR URLs recorded in checkpoint and ledger.

## Out of scope
Any code change. Phase 1–3 builds are future sessions (see issues).
