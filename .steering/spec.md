# Craft video kind host-wiring — spec and verification
Source of truth: ~/Desktop/allternit-workspace/HANDOFF-craft-editors-2026-10-10.md item 2 remainder; ai repo PRs #497 (image pattern) and #500 / platform #1480 (app-independent parts, merged).

- [ ] `src/components/craft/video-io.ts`: classifyVideoSave (fcproj→source; mp4/mov/webm/m4v→export-video; else→other; FilmCraft sends no `format`, classify by name ext + meta.path correlation), resolveVideoOpen (stored craft/source.fcproj → footage media-plane ref (meta.media.url) → body project JSON → body URL), storeVideoSource/storeVideoExport (runtime storage, personal scope), buildInitialVideoProject (minimal current-schema .fcproj envelope), footageRefFromMeta (object form + legacy `media:'video'` + body-URL fallback).
- [ ] CraftEditor.tsx: VideoCraftEditor (app="video") — source save → runtime storage + host-requested MP4 export via file.exportMedia {path}; export save-request → uploadAttachmentToCloud → save() version body=url text/uri-list with media ref meta; other → craft/export.<ext>. declareStorage on mount. Phone viewport → view + Edit entry (full FilmCraft), trim adaptation NOT claimed.
- [ ] bridge.ts: video embed loads `?empty=1` so FilmCraft skips its demo project (comment explains; other apps unaffected).
- [ ] viewers.tsx VideoViewer: footage URL → playable <video> (auth-aware blob fetch like VideoMedia); project-JSON-only → "not rendered yet" empty state.
- [ ] kinds.ts: video entry Viewer=V.video, Editor=VideoCraftEditor, exports [Download video (source), Copy link]; export.ts 'source' downloads the MP4 for kind video.
- [ ] from-transcript.ts: selectedToDraft video → kind 'video', body = buildInitialVideoProject, meta = { media: { url, mime }, filename } (media-plane ref; never inline bytes). Chat SelectedArtifact/download/preview behavior preserved.
- [ ] ArtifactsView: upload video file → video-kind artifact (cloud upload, plan caps server-side), parity with image upload.
- [ ] Tests: video-io.test.ts mirroring image-io.test.ts; registry-rules additions for the video draft/open/classify.
- [ ] Verification: pnpm install --ignore-scripts; pnpm typecheck exit 0; vitest craft + registry + api-store + agent-mode-executor + artifact-smoke suites green; node scripts/check-sw-cache-bump.mjs → "No Fabric Session asset changes."; playwright craft:1 handshake smoke vs live office.allternit.com/craft/video/ (no deploys; all processes killed).
- [ ] Platform companion PR: artifact-modes.mdx states shipped behavior; features.json video-kind shipped status/components/dated decisions; python3.11 scripts/dependency-map.py --validate clean; check_links.py 0 problems; impact summaries in both PR bodies.
- [ ] No cloud-api changes (server gate already admits video — verified). No vendored-tree changes. No deploys. No merge.
- [ ] Build outputs deleted (node_modules/dist/tmp) before finishing; worktrees + branches intact for review.
