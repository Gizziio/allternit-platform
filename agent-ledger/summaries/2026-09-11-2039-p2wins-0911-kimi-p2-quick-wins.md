# Session attestation — session/p2wins-0911 (P2 quick wins)

- **Date:** 2026-09-11
- **Agent family:** kimi
- **Code PR:** #394 — merge commit `a65241c18` (`--merge`, Vercel red account-wide as expected)
- **Scope:** mapping doc §3 port #4 (IndexedDB file versions), §2 row 15 (Team tab honesty label), §2 row 9 (artifact sandbox policy)

## What was done

### 1. IndexedDB file versions (§3 port #4 — open-design `.file-versions`)

`surfaces/ai.allternit.com/src/lib/design/project-file-store.ts`:

- DB version 1 → 2; upgrade path creates a new `fileVersions` object store
  (keyPath `id`). Records: `{ id: \`${projectId}:${path}\`, projectId, path,
  versions: [{ hash, content, savedAt }] }`.
- `writeProjectFile` appends to version history (djb2 string hash; back-to-back
  identical writes deduped). History capped at 10 versions per file, oldest
  dropped. Versioning is best-effort: a failure in the version store never
  loses the file write.
- New APIs: `listFileVersions(projectId, path)` (oldest first, `[]` on any
  failure) and `restoreFileVersion(projectId, path, index)` — a restore is
  itself recorded as a new version.
- UI: `ProjectFileWorkspace.tsx` gains a compact "History" button in the
  editor header opening a popover of timestamps (newest first, current
  labelled) with per-version "Restore this version" buttons; inline-style
  conventions of the file kept.
- Tests: `project-file-store.test.ts` (8 tests) with a store-aware fake
  IndexedDB — the gallery-store fake models only one anonymous store per DB;
  the new fake models named stores + `onupgradeneeded`, so the real v1→v2
  upgrade handler runs in the upgrade test. Covers: accumulate/dedupe, cap at
  10 (oldest dropped), restore content + restore recorded, missing-index
  throw, per-project/per-path isolation, history survives file delete, and
  v1-shaped DB upgrade without crash.

### 2. Team tab honesty label (§2 row 15) — already satisfied on main

`DesignTeamWorkspace.tsx:174-188` already carries a plain Register 1 in-tab
banner: "Preview — collaboration is not wired up yet… mock data: nothing is
shared, sent, or synced." Landed same-day in `ef79c4166`. Verified against the
requirement (in-tab, banner-not-redesign, honest about zero network calls); no
new code.

### 3. Artifact sandbox policy codified (§2 row 9)

Audit of `src/components/artifact/ArtifactRenderer.tsx`:

- **Confirmed sound (enforced):** HTML/React artifact path uses
  `sandbox="allow-scripts allow-forms allow-modals"` + `srcDoc` — no
  `allow-same-origin` anywhere; storage shim (`injectSandboxStorageShim`)
  shadows `localStorage`/`sessionStorage` with in-memory objects.
- **Real hole found and fixed in code:** `SVGRenderer` and `MarkdownRenderer`
  injected artifact markup into the **host document** via
  `dangerouslySetInnerHTML` (markdown transform does not sanitize raw inline
  HTML). Both now route through the sandboxed `HTMLRenderer` iframe
  (opaque origin). New `ArtifactRenderer.test.tsx` (4 tests): no
  `allow-same-origin` for every artifact type, SVG/markdown render inside the
  iframe, shim idempotence/insertion.
- **Documented:** `surfaces/ai.allternit.com/DESIGN.md` new §11 "Artifact
  sandbox" — sandbox semantics, why no `allow-same-origin`, the storage shim,
  the new-renderer rule, and an honest advisory section: **CSP is NOT set**,
  network egress is not blocked (fetch/XHR subject only to target CORS;
  script/img/link loads unrestricted). Tightening filed as follow-up
  **issue #396**.

## Verification

- `pnpm typecheck` — 0 errors.
- `pnpm vitest run src/lib/design src/shell src/views/design` — **82/82
  passed, 14 files** (baseline this morning 66/12; +8 from this session's
  project-file-store tests, +8 from concurrent fedesign merge).
- `pnpm vitest run src/components/artifact` — 4/4 (new).
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed.
- Desktop rebuilt from post-merge state; bundle grep + DMG handling recorded
  in LEDGER.md bullet and the orchestrator report.

## Incidents / deferrals

- Vercel checks red account-wide — merged anyway per program instruction.
- DESIGN.md on main is v2.0 (2026-05-09); the "v2.1 amber-only" update
  mentioned in the session brief was not on main at branch time — §11 was
  written to apply regardless of version header.
- CSP / egress tightening deferred to issue #396 (needs an allowlist decision,
  not a blanket block — artifacts legitimately load CDN resources).
