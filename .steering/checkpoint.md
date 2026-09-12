# Steering checkpoint

## Goal
Session: session/artifactsapi-0911, worktree allternit-session-artifactsapi-0911,
from origin/main @ 9b01fc5bf. DESIGN BEFORE BUILD — design doc + tracking
issues only for the A:// Artifacts API (mapping doc §2 row 16, Eoj amendment
2026-09-11). Plan at .steering/plans/plan-artifactsapi-0911.md.

## Just did
- Worktree created. Read the real code first: ArtifactRenderer.tsx (sandboxed
  srcDoc iframe + storage shim), artifact-parser.ts (splitOnArtifacts),
  gallery-store.ts / project-file-store.ts (the two IndexedDB stores),
  artifact-export.ts (client-side export tiers), artifact_routes.rs (existing
  *document* artifact API — adjacent, untouched), migrations V1–V145
  (next: V146), docs/NATIVE_SESSIONS.md + AGENT_EMAIL_RAIL.md for doc style.
- Wrote `docs/design/artifacts-api.md` (8 sections, DECIDED/OPEN marked).

## Next
- Commit + push session/artifactsapi-0911; PR → merge (--merge).
- gh issues: epic + 3 phase issues (enhancement label), linked.
- Ledger branch session/ledger-artifactsapi-0911: summary + LEDGER.md bullet,
  PR, merge.
- Cleanup: worktree remove, delete both branches local+remote. No desktop
  rebuild (docs-only, ritual skip rule).

## Open questions
- §6 publish/relay tier questions (4 publish + 2 relay) are OPEN for Eoj —
  listed in the design doc; Phase 3 blocked on the publish answers.
