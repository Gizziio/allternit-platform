# Steering checkpoint — session/designfixes-0912

## Goal
Deferred design UI work, 3 items: (1) critique-panel image wiring, (2) gallery
thumbnails (view layer only — gallery-store/project-file-store/content-artifact-sync
owned by sibling artphase2-0912), (3) `/design` ack channel (gizzi-code receipt
file + CLI pickup confirmation). Desktop rebuild required after merge.

## Just did
- Read surgicaleye-0911 attestation (context), critique route, /design command,
  DesignModeView, NewProjectScreen, gallery/artifact-thumbnail libs, gizzi
  state-dir conventions (`~/.allternit`, orchestrator.ts precedent).
- Findings: save-time thumbnail capture ALREADY exists (renderArtifactThumbnail
  → entry.thumbnail); remaining gallery gap = view-side generation for
  thumbnail-less entries + consistent card sizing. Critique route accepts html
  only. No ack channel exists anywhere.
- Wrote plan `.steering/plans/plan-designfixes-0912.md`. pnpm install done.

## Next
Land: merge origin/main before PR (sibling concurrency), conventional commits,
gh pr create + merge --merge, ledger attestation, desktop rebuild, cleanup.

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

## Open questions
- None.
