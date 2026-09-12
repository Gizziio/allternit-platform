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
