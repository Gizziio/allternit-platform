# Steering checkpoint

**Session:** `session/craft-video-host-20261010` · ai worktree `allternit-ai-wt-craft-video-host` (+ platform worktree `allternit-wt-craft-video-host`) · plan dag_76461 (node add/claim/close broken in gizzi 2.1.9 — plan id recorded only)
**Date:** 2026-10-10 · **State: ai PR PUSHED (commit on session/craft-video-host-20261010); platform commit pending the send-fix bundle rebuild (queued on another session's cargo lock)**

## Goal
Craft editors Phase 3 remainder: video kind host wiring. DONE on the ai side: opening a `video`-kind artifact launches FilmCraft over craft:1; `.fcproj` source round-trips through artifact runtime storage; host-requested exports → MP4 → R2 → new version body; footage = media-plane refs in meta.media; media_generate videos + library uploads become video-kind; phone/PWA v1 = view + Edit entry (trim not claimed). DO NOT MERGE (Eoj merges). cloud-api untouched (gate admits video since #1477, re-verified).

## Just did (final state)
- **ai repo: committed + pushed** (`session/craft-video-host-20261010`): video-io.ts (classify/resolve/store/buildInitialVideoProject/footageRefFromMeta), VideoCraftEditor (+phone gate), VideoViewer, kinds wiring, export.ts source-for-video, from-transcript media_generate→video-kind, ArtifactsView Upload video, bridge wire-format + opaque-origin fixes (`?empty=1`, kebab-case wire matching the compiled crate, numeric command ids, host→app `*` delivery, app→host `'null'` origin accepted with source pinned, `error` message → fatal). CraftEditor followUp/afterOpen generic hooks. Tests: vitest 175/175 across 19 touched suites (craft 42 incl. new wire/opaque-origin tests, video-io 19, registry 25); typecheck exit 0; SW guard clean.
- **Live smoke (Playwright, installed Chrome, no deploys)** caught FIVE independent full-blockers — nothing had ever booted the embed end-to-end: (1) office /craft/* CSP (applying since #1475) blocked inline boot scripts + wasm fetch + opaque-origin module loads → fixed in _headers; (2) bridge.ts wire format mismatch (craft:-prefixed vs the crate's bare kebab-case + numeric ids) → bridge corrected, PROTOCOL.md corrected; (3) opaque-origin postMessage (host→app must target '*', app→host arrives as 'null'); (4) craft-host wasm transport dropped every [json,bytes] message AND send() passed the message array as the transfer list (DataCloneError swallowed) → fixed in the crate (Allternit-authored); (5) FilmCraft embed mode stalled save-requests when idle (egui stops repaints) → 250ms repaint cadence.
- **Platform**: docs + map done (artifact-modes shipped paragraph; artifacts-v2 contract bullet; features.json Phase-3 decision + corrected mirror claim; five PRE-EXISTING --validate red entries fixed; check_links 0 problems; --validate exit 0 with the ai worktree). FilmCraft bundle rebuilt twice (open-bytes fix, then cadence fix) and published to surfaces/office.allternit.com/public/craft/video/ (craft:1 ×7, wasm 23.1 MB, 0 ≥25 MiB). Smoke verified through the save watcher firing: `craft:1: save-request for /projects/Smoke.fcproj (1503 bytes)` — but the send() transfer-list bug blocked its delivery; the send-fix rebuild is QUEUED behind another session's cargo test lock on the shared target.

## Next
1. Send-fix rebuild completes → publish → re-run the full smoke (expect the save-request to ARRIVE) → commit + push the platform PR.
2. Eoj: merge BOTH PRs together (ai bridge speaks the corrected wire + expects the corrected headers). Office deploy applies CSP + new bundle; ai deploys the host wiring; the in-product save test can finally run.
3. Follow-up flagged in both PR bodies: rebuild the image/pdf bundles (same craft-host crate, no code change) before announcing pdf/image editing.

## Open questions
- Export-on-save encode cost; cross-session media relink edge cases; phone trim UX — all flagged in the PR bodies.
- Image/pdf bundles share the pre-fix crate (flagged follow-up, deliberately not redeployed here).
