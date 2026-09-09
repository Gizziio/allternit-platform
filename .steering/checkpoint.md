# Steering checkpoint — session/cu15

## Goal
Restructure docs/public/aci/** into a quickstart spine (Quickstart / Guide / Recipes / Changelog); add llms.txt at repo root. Keep every existing factual claim; move, don't delete. Sole ownership: docs/public/** + llms.txt. Do NOT merge — orchestrator merges.

## Just did
- Restructured docs/public/aci/ from a single index.md into a 5-page spine:
  - index.md — intro, ACI vs managed sandboxes table, doc-set TOC.
  - quickstart.md — manual one-call quickstart (real, from main) + clearly-marked "Coming soon — not yet available on main" placeholder for the cu14 `demo` command.
  - guide.md — integration modes (ACU run loop / direct control routes / capability path), action space + tool versions 20250124/20251124, approvals + server-side enforcement (D2, grants taxonomy), environments + VM driver, recording/replay (SSE replay buffer), monitoring, vision coordinates pointer.
  - recipes.md — drive my browser, replay a recording (SSE replay buffer), run a taught workflow (marked not-yet-available), approve a risky action (handoff flow).
  - changelog.md — tool contract: 20250124 initial set (default), 20251124 adds zoom (enableZoom), legacy anthropicType adapter note.
- Added llms.txt at repo root (all 30+ links verified to resolve on disk).
- Updated stale anchor link docs/public/parity/appshots.md → aci/guide.md#action-space-and-tool-versions.
- Verification: docs-lint output identical to pre-change baseline (only pre-existing FAILs in surfaces/docs/cli/native-sessions.mdx competitor mentions, outside scope); 27/27 key factual strings from old index.md confirmed present in new pages; all in-spine relative links valid.

## Next
- Commit (docs(aci): ...), push -u origin session/cu15, gh pr create with before/after TOC + evidence. Do NOT merge.

## Open questions
- None.
