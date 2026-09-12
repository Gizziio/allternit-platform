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
- DONE (commit 115fa8697): read-through caches — new content-artifact-api.ts raw client;
  gallery-store gateway-first list + write-through upsert + soft-delete sync;
  project-file-store /index.html read/write-through; sync module = thin delegates;
  store tests rewritten (24/24 green).
- DONE (commit 7d1054fd5): chat persist step (ArtifactSidePanel Save-to-artifacts +
  sourceSessionId provenance via ChatView), cowork a:// resolution
  (ArtifactAddressCard + CoworkStreamBlock + UnifiedMessageRenderer text parts),
  typed renderers (DeckRenderer slide chrome, MobileRenderer 390px frame, prototype
  pinned), doc §2.1 DECIDED. Web typecheck 0 errors; lib/design + components/artifact
  vitest 97/97 green.
- DONE (uncommitted): gizzi-code `artifact list/show/save` commands + allternitApi
  content-artifact client fns + registry wiring. `bun run typecheck` clean,
  `bun run script/build-production.js` green, `gizzi artifact --help` works.
  NOTE: :8013 on this machine is a static SPA server (405 on POST), not
  allternit-api — live smoke uses a scratch gateway on :18013.

## Next
- Live curl + CLI smoke against scratch gateway (cargo build running in background).
- cargo test -p allternit-api (prove no new failures vs pre-existing list).
- release-preflight 35/0; design vitest full dirs; PR + merge; issue 388 comment/close;
  ledger branch + attestation; desktop rebuild; cleanup.

## Open questions
- File-ownership note: shared setup §6 lists this session's scope as "sibling owns" — the
  per-session specs contradict it; following the per-session spec (artphase2 owns stores,
  chat persist, cowork links, gizzi-code commands, typed renderers; designfixes owns the
  gallery VIEW layer). Will note in PR body.
- Typed renderers touch ArtifactRenderer.tsx (src/components/artifact) — sibling's
  thumbnail work may also render artifacts; keeping changes additive (new cases only).
