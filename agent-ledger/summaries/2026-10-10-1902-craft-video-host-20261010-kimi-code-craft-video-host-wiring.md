# Craft video host-wiring + the embed-boot incident (pdf/image/video alike)

Session: `session/craft-video-host-20261010` (+ `session/craft-image-pdf-bundle-rebuild-20261010`) ·
Agent: kimi-code (delegated workers) · 2026-10-10 · Eoj-ordered merges.
Merged: ai **#508** (`dd6991293`), platform **#1490** (`b09dc8e68`), platform **#1493** (`e73deeaa0e`).
Branch: `session/craft-video-host-20261010` branched from main `d26f793d`; rebuild branch stacked on #1490.

## What landed
- **Video open/edit/save end-to-end** (`src/components/craft/video-io.ts`, mirrors image-io): open
  ladder stored `craft/source.fcproj` → footage re-imported under the same virtual path
  (`followUp` hook) → first-open `craft:open` mp4 + host `file.saveAs` (`afterOpen` hook; the app's
  Save never prompts). Saves routed by extension + `meta.path`: `.fcproj` → runtime storage
  (personal, 5 MB/value cap) + host-requested `file.exportMedia` MP4; export save-request → R2 →
  new `text/uri-list` version with `meta.media = {url, mime?}`; other → `craft/export.<ext>`.
  Footage NEVER in the 20 MB text budget; media-plane blobs via `mediaArtifactsApi.fetchBlob`
  (auth/gateway-origin safe on PWA). Legacy `media:'video'` + body-URL records still read.
- **`media_generate` → video-kind** (`from-transcript.ts`): body = minimal current-schema `.fcproj`
  project JSON (`application/vnd.allternit.video+json`), footage ref in meta; chat
  card/download/preview untouched. Plus **Upload video** in the Artifacts library.
- **Phone/PWA v1**: playable `VideoViewer` + "Edit video" mounting full FilmCraft, gated on
  `useIsPhoneViewport()`; shared registry sheet covers ai.allternit.com phone + m.allternit.com PWA.
  Trim-adapted phone UX explicitly NOT claimed.
- **PhotoCraft/PdfCraft bundles rebuilt with the fixed craft-host** (#1493): image wasm
  25,332,694 B / pdf 23,849,253 B, craft:1 ×4 each, 0 files ≥25 MiB, office 3-file layouts kept,
  old-hash files removed. Cosmetic: regenerated the gitignored app-icon tile (128² #2f7bf5 r28)
  that the original committer never committed — documented in PR, left gitignored in the worktree
  (worktree since removed; asset reproducible per `assets/app-icon/README.md`).

## The embed-boot incident — nothing had ever booted
The brief-required live browser smoke (production bridge + Playwright/Chrome vs the real bundle,
no deploys) caught **five independent full-blockers**, three shipped by earlier phases:
1. Office CSP (live since #1475): `connect-src 'none'`, no `unsafe-inline`, COEP without CORP →
   blocked wasm fetch, inline boot, cross-origin loads. Fixed in `_headers`.
2. Wire mismatch: bridge spoke `craft:`-prefixed types/string ids; bundles speak bare kebab-case
   types/numeric ids. Bridge + `PROTOCOL.md` corrected to the compiled contract.
3. Opaque-origin postMessage: host→app must target `'*'`; app→host arrives origin `'null'` (pin
   `event.source`).
4. craft-host dropped every message with bytes (string-only parse) + `send()` passed the message
   array as the transfer list (DataCloneError swallowed) — fixed in the Allternit-authored crate;
   all three bundles rebuilt.
5. Idle frame stall: save watcher ran per UI frame; idle egui stops repainting → embed keeps a
   250 ms cadence.
**Consequence:** prior "pdf/image live" claims were deployment-true but the embed had never booted;
recorded in the handoff so future sessions require a live smoke for embed claims.

## Verification
- `pnpm typecheck` exit 0; vitest **175/175 across 19 touched suites** (craft 42 incl. new
  wire/opaque-origin tests, video-io 19, registry 25); `check-sw-cache-bump.mjs` green (no
  CACHE_NAME bump); `check_links.py` 0 problems; dependency-map `--validate` exit 0 (also fixed
  five pre-existing red entries that made it fail on origin/main).
- **Live smoke: `errors: []`** — handshake 1.3 s → open real H.264 MP4 → `open-ack` (WebCodecs) →
  `file.saveAs` → save-request `Smoke.fcproj` (1503 B) delivered + acked → 30 export presets →
  clean reopen of the schema-11 project.
- cloud-api: NOT touched — `craft_store` gate admits `image|video` since #1477 (re-verified
  `runtime.rs:187`).
- Post-merge: ai.allternit.com Production/Active at `dd69912`; office Pages builds for both
  platform merges roll out on their own (verified separately after builds land).

## Lessons
- **For the craft embed, builds/tests/green deploys are NOT evidence — only a live browser smoke
  is.** Make the smoke a standing gate for any bundle/bridge/CSP change.
- Bundle-committed work must commit its build inputs (the gitignored app-icon PNG died with its
  author's worktree once already).
- 2-hour background worker caps: the host-wiring worker hit its cap mid-implementation; resuming
  with full context recovered cleanly (work preserved uncommitted in the worktree).

## Deferred (honest)
- Trim-adapted phone UX (v1 ships view + full-edit entry, flagged in PR body).
- Cross-session media relink edge cases → FilmCraft's relink UI.
- Export-on-save encode cost per save (acceptable for v1).
- Legacy `image`-kind video records stay image-kind (no migration).
- gizzi workspace node CLI still broken (plans dag_724767 / dag_76461 created untracked).

## Same-night companion work (separate attestations/docs)
- cloud-api manual deploy + PWA deploy + migrations 085–087: `Infra/deploy-runbook.md`
  "Manual cloud-api deploy — verified procedure 2026-10-10".
- Video-kind registry slice: attestation `b7bb1820db` / summaries
  `2026-10-10-1408-craft-video-kind-20261010-kimi-code-craft-video-registry-bundle.md`.
