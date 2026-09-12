# Steering checkpoint — session/artphase2-0912

## Goal
Artifacts API Phase 2 — cross-surface consumption (gateway + web + gizzi-code).
Issue #388. Sibling: designfixes-0912 (gallery view layer, critique images, /design ack).

## Just did
- Read AGENTS.md ritual + docs/design/artifacts-api.md (§2.1, §5, §7 Phase 2).
- Read Phase 1 code: content_artifact_routes.rs (complete, no gateway changes needed),
  content-artifact-sync.ts, gallery-store.ts, project-file-store.ts, ArtifactRenderer.tsx,
  artifact-panel/side panel, cowork stream blocks, gizzi-code html-artifact command +
  allternitApi client.
- Created worktree + branch session/artphase2-0912 (origin/main @ 00a186602).
- pnpm install done (2m05s).
- Wrote .steering/plans/plan-artphase2-0912.md.

## Next
Implement work items 1–7 (content-artifact-api.ts → stores read-through → chat persist →
cowork a:// links → gizzi-code artifact commands → typed renderers + doc §2.1 DECIDED),
then verification battery, PR, ledger, desktop rebuild, cleanup.

## Open questions
- File-ownership note: shared setup §6 lists this session's scope as "sibling owns" — the
  per-session specs contradict it; following the per-session spec (artphase2 owns stores,
  chat persist, cowork links, gizzi-code commands, typed renderers; designfixes owns the
  gallery VIEW layer). Will note in PR body.
- Typed renderers touch ArtifactRenderer.tsx (src/components/artifact) — sibling's
  thumbnail work may also render artifacts; keeping changes additive (new cases only).
