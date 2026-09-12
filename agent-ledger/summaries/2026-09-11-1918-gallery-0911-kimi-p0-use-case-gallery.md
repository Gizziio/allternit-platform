# Session summary — gallery-0911 (P0 use-case gallery, mapping doc §6)

- **Session:** `session/gallery-0911`
- **Agent family:** kimi-code
- **Date:** 2026-09-11 19:18
- **PR:** #378, merge commit `920696667`

## What was done

Ported the kimi.com/design marketing principle — **show outputs, not inputs** —
to the A:// Studio landing, per the LOCKED mapping doc §6 addendum (Eoj, field
research 2026-09-11). The studio landing previously showed only
system/marketplace pickers (input-oriented); it now has a Gallery tab with a
categorized wall of real generated artifacts and click-to-remix.

**Data layer** — `src/lib/design/gallery-store.ts`: IndexedDB
`allternit-design-gallery` / `entries`, one entry per project. Entry carries
projectId/name, prompt (first user message), creation type, designSystemId,
skillId/skillName, full artifact HTML (for remix), optional JPEG thumbnail,
createdAt/updatedAt. Upsert preserves createdAt; list is newest-first.

**Capture-on-save** — `src/lib/design/artifact-thumbnail.ts` +
DesignModeView effect. When the latest artifact (a) passes the P0 lint gate
(the locked "linter gate = feature filter"), (b) is not streaming, (c) has a
new djb2 content hash, the entry is upserted with a best-effort thumbnail:
artifact HTML → SVG foreignObject → canvas → JPEG dataURL. Inline-CSS
artifacts only (the skill contract); external stylesheets/images/fonts are
never fetched; any failure yields `thumbnail: undefined` and never blocks the
save path. The render-and-compare util (P1.5 port) supersedes this capture.

**Gallery UI** — NewProjectScreen gains a Gallery tab in the ad-library nav:
pill row (All + creation types present: Landing pages, Decks, Dashboards,
Mobile apps, Brand systems, Content engines, Templates, Other) over a
CSS-columns masonry. Cards show the thumbnail or an honest initial-letter
tile — no fake imagery. Click = remix: `remixGalleryEntry` forks a new project
(`Remix — <name>`), copies the artifact HTML to `/index.html` in the new
project's IndexedDB file tree, restores the bound design system, seeds the
composer with the original prompt, and opens the project through the existing
recovery-session path (extracted from the inline JSX handler into
`openProjectRecord`).

## Verification

- `pnpm typecheck` — 0 errors
- `pnpm vitest run src/lib/design` + `NewProjectScreen.test.tsx` — **39/39**
  (8 files; +gallery-store 4, +artifact-thumbnail 3, +gallery component 2
  tests using a mini in-memory IndexedDB fake)
- `pnpm vitest run src/shell` — 21/21

## Incidents
- None.

## Honest deferrals (locked plan, not this session)
- P1 one-box zero-friction start; P2 aspect/format picker; P3 disclaimer
  footer; P1.5 render-and-compare screenshots (will replace capture-on-save
  thumbnails).
- Gallery thumbnails depend on the foreignObject path until P1.5; artifacts
  with external assets render as initial-letter tiles in the meantime.
- No seed/demo entries shipped — the gallery fills from real local use by
  design (honesty over demo data).
