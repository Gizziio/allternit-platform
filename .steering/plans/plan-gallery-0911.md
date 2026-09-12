# Plan — session/gallery-0911 (P0 use-case gallery, mapping doc §6)

## Goal
Port kimi.com/design's core marketing principle — **show outputs, not inputs** —
to the A:// Studio landing: a Gallery tab with category pill tabs (matched to
creation types) over a masonry wall of REAL generated artifacts, each card
click-to-remix. Locked scope: no new backend, IndexedDB only, linter gate as the
feature filter, capture-on-save seeding until render-and-compare (P1.5) lands.

## Data model
New `src/lib/design/gallery-store.ts` — IndexedDB `allternit-design-gallery` /
store `entries` (keyPath `id`). Entry:
`{ id, projectId, projectName, prompt, type (DesignProjectType), designSystemId?,
  skillId?, skillName?, artifactHtml, thumbnail? (dataURL), createdAt, updatedAt }`
Unique per project (upsert replaces the project's entry when a newer artifact
finalizes).

## Capture-on-save (seeding)
New effect in DesignModeView on `latestArtifactHtml`: capture only when
(a) an active project exists, (b) not streaming, (c) the artifact passes the P0
lint gate (`getP0Findings` empty — the locked "linter gate = feature filter"),
(d) content hash dedupe. Prompt = first user message; skill + design system from
session state; thumbnail via new `artifact-thumbnail.ts` (foreignObject SVG →
canvas → JPEG dataURL, inline-CSS artifacts only, failure → `undefined`, never
blocks save).

## Remix
Click card → new project (`Remix — <name>`), artifact HTML copied to
`/index.html` in the new project's file tree, bound `designSystemId` carried
over, composer seeded with the original prompt, project opened (reuses the
existing openProject recovery-session path — refactor that inline JSX handler
into a function).

## UI
`ad-library` gains a **Gallery** tab: pill row (All + present types) over a
CSS-columns masonry of cards (thumbnail img, else an honest name/type tile — no
fake imagery), project name + type + skill chip, click = remix. Empty state:
"Artifacts you create will appear here." Amber-law launch tokens, `ad-` classes.

## Todos
- [ ] gallery-store.ts + artifact-thumbnail.ts (+ tests, mini fake-IDB)
- [ ] DesignModeView capture effect + openProject refactor + onRemix
- [ ] NewProjectScreen gallery tab + CSS
- [ ] typecheck 0 + vitest green (new + design 27/27 + shell 21/21)
- [ ] PR → merge → ledger → preflight → desktop rebuild → cleanup

## Out of scope (locked plan)
P1 one-box start, P2 aspect picker, P3 disclaimer footer, P1.5 render-and-compare
screenshots (replaces capture-on-save thumbnails when it lands).
