# Steering checkpoint — session/designfixes-0912

- **Goal:** Deferred design UI work, 3 items: (1) critique-panel image wiring, (2) gallery
  thumbnails (view layer only — gallery-store/project-file-store/content-artifact-sync
  owned by sibling artphase2-0912), (3) `/design` ack channel (gizzi-code receipt
  file + CLI pickup confirmation). Desktop rebuild required after merge.
- **Just did:** All three items implemented and verified (see status below); merged
  concurrent origin/main (PR #414 fabric-cowork-switch checkpoint kept, theirs first).
- **Next:** PR, `gh pr merge --merge`, ledger attestation, desktop rebuild, cleanup.
- **Open questions:** none.

## Status (all three items implemented + verified)
- Critique images: turn-images.ts (11 tests), panel strip + images in POST body,
  gizzi critique route accepts images (max 6) and embeds capped markdown refs in
  the panelist prompt. Smoke: 2-image request validates (503=no brain only),
  7 images → 400.
- Gallery thumbnails: GalleryCardImage lazy client-side capture for
  thumbnail-less entries (module cache, placeholder fallback), CSS 4/3 cover.
- /design ack: gizzi routes/design.ts POST+GET /v1/design/ack →
  ~/.allternit/design-prompt-ack.json (env override); web reporter fires on
  initialPrompt consume; CLI polls receipt ≤8s and prints pickup confirmation.
  Smoke: 404→200→200, invalid → 400.
- Verification: pnpm typecheck 0 errors; vitest 111/111 (14 files);
  bun typecheck 0; build-production.js exit 0 (bundle greps: design-prompt-ack.json ×4,
  picked up your prompt ×3, attached-image- ×3); release-preflight 35/0.

---

# Prior checkpoint — session/fabric-cowork-switch-0912 (merged via #414)

- **Goal:** Fabric Transport — composer Home/Cowork/Bots toggle must switch the canvas (cowork was a dead click); rename the switcher's "Chat" segment to "Home".
- **Just did:** Worktree `fabric-cowork-switch-0912` off origin/main (`00a186602`). `FabricSessionPanel` `allternit:switch-mode` handler now routes `cowork` → chat kind + cowork canvas (+ clears node session selection), `chat` → chat canvas; app-mode mirror reflects the cowork canvas so the toggle highlights the right segment. `BottomDock` segment label Chat → Home (aria-label too) + tests updated. SW v40→v41. Typecheck ✅, BottomDock + dispatch tests 17 passed ✅, build + prepare verified v41.
- **Next:** (landed — PR #414)
- **Open questions:** none.

---

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
