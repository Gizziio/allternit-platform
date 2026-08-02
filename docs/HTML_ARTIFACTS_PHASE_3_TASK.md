# Phase 3 — iOS: version awareness + confirm render of gizzi-code-published artifacts

Read `docs/HTML_ARTIFACTS_MAP.md`, `docs/HTML_ARTIFACTS_PHASE_1_NOTES.md`,
and `docs/HTML_ARTIFACTS_PHASE_2_NOTES.md` first — both prior phases are
reviewed and approved. This phase is scoped to
`surfaces/allternit-mobile/ios` ONLY. Do not touch `cmd/gizzi-code` or
`cmd/allternit-api`.

## Context you need from Phase 1/2

- Canvases now carry `artifact_key: string | null` and `version: number`
  (Phase 1). A redeploy of the same `artifact_key` updates the same canvas
  row in place and increments `version` — it does NOT create a new canvas.
- `gizzi html-artifact publish` (Phase 2) publishes a canvas whose
  `components` is `[{ type: "artifact", kind: "html", title, content: htmlString }]`.
  Phase 2's own notes flag this shape as **a best guess**, not a contract
  verified against your parsing code — "matched the frontend's
  `ArtifactUIPart` shape minus `artifactId`/`url` (fields only a consumer
  fills in), flagging clearly so Phase 3 can adjust the shape if the real
  iOS parsing needs something different." **Your job includes checking this
  guess against reality and fixing whichever side is wrong** — either
  gizzi-code's `components` shape, or iOS's parsing, whichever is the
  actual mismatch (document which).

## Scope

### 1. Verify (and if needed, fix) canvas → ArtifactRecord parsing

Find where `ArtifactLibraryStore.refreshFromBackend()` (or whatever it
calls) turns a fetched canvas's `components` entries into local
`ArtifactRecord`s (per the map doc: `type == "artifact"` components are
extracted). Trace it against the actual shape gizzi-code now sends:
`{ type: "artifact", kind: "html", title, content }`. If field names don't
line up (e.g. iOS expects `artifactId`/`url` that gizzi-code's payload
doesn't send), decide the minimal correct fix — most likely: iOS should
tolerate the fields gizzi-code actually sends without requiring
`artifactId`/`url` (a locally-published html artifact doesn't have those
concepts yet), and derive whatever an `ArtifactRecord` needs
(`id`/`artifactId`) from the canvas's own `id`/`artifact_key` instead.
Do NOT change gizzi-code's payload shape — that's Phase 2, already
reviewed; fix on the iOS side unless you find a concrete reason iOS's
existing shape is the one other real callers already depend on (check
before assuming — grep for other producers of `type: "artifact"` canvas
components, e.g. the web app's `canvas-artifact-events.ts` mentioned in the
map doc, to see if iOS's current shape assumption is load-bearing
elsewhere).

### 2. Version awareness in the local model

`ArtifactRecord` (`Features/Artifacts/Views/ArtifactDetailsView.swift:3-32`)
has no version field today; `ArtifactLibraryStore.record()` does
remove-then-reinsert (last-write-wins, no history). Add a `version: Int?`
field to `ArtifactRecord` (optional — locally-created/legacy artifacts
without a backend canvas won't have one) and thread it through wherever the
record is constructed from a fetched canvas (`refreshFromBackend()` /
wherever `mirrorToBackend`'s counterpart parses incoming canvases). This
phase does NOT need a full version-history UI — just: the field exists,
gets populated from the canvas's `version`, and a fetched canvas with a
lower-or-equal `version` than what's already stored locally should not
clobber newer local state (basic monotonic-version guard, since
`refreshFromBackend()` currently does an unconditional last-write-wins
merge — check its actual merge logic before assuming this needs changing;
if the existing "local wins on conflict" rule already achieves this
correctly for the fields that matter, say so and don't add redundant logic).

### 3. Confirm rendering actually works

`SandboxedArtifactWebView.swift` already renders HTML content via a custom
`artifact://` scheme + CSP. Confirm it correctly renders content that came
from a gizzi-code-published canvas specifically (not just hand-authored
test content) — after your parsing fix in step 1, an artifact published by
`gizzi html-artifact publish` and then fetched via `refreshFromBackend()`
should show up in the Artifacts Library and render correctly in
`ArtifactDetailsView`. The `<style>` block gizzi-code's generator emits
uses inline `<script>` for the tab switcher when there's more than one tab
— confirm the WKWebView's CSP (`default-src 'none'`, JS enabled only for
html/js types per the map doc) actually allows this inline script to run,
since a `default-src 'none'` CSP without `'unsafe-inline'` on `script-src`
would silently block it. If it's blocked, that's a real bug to flag/fix
(document exactly what you found — don't just assume it works because the
CSP exists).

## Constraints

- No changes to `cmd/gizzi-code` or `cmd/allternit-api`.
- Actually build: `xcodebuild` for this target must succeed (check
  `git status --porcelain` first; this worktree's `allternit-api` from
  Phase 1 is right there if you need a real backend running locally to
  test against — same approach Phase 1/2 used, throwaway
  `ALLTERNIT_DATA_DIR`, `ALLTERNIT_LOCAL_DEV_BYPASS=true`).
- If you can run the app in the iOS Simulator and actually exercise the
  Artifacts Library against a real locally-running allternit-api with a
  real gizzi-code-published canvas (using this same worktree's `cmd/gizzi-code`
  and `cmd/allternit-api`, both already working per Phase 1/2), do that —
  it's the only way to catch a CSP-blocks-the-script-tag class of bug that
  static reading won't. If the simulator genuinely isn't workable in this
  environment, say so explicitly and explain what you verified instead
  (e.g. unit-testing the parsing function directly with a fixture matching
  gizzi-code's real payload shape).
- Match existing SwiftUI/repo conventions — read the surrounding code in
  each file before editing.

## Deliverable

`docs/HTML_ARTIFACTS_PHASE_3_NOTES.md`, same frontmatter contract as
Phases 1/2, then prose: what the actual `components` shape mismatch (if
any) was and how you resolved it, the version-awareness change, and your
verification (simulator run or the fallback you used, with real
output/screenshots-described-in-text as applicable). Do not start Phase 4.
That file existing = phase done.
