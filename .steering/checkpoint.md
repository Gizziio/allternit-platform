# Steering checkpoint

**Goal:** WebMCP-shaped tool layer + semantic tool-call logging + timeline playback viewer — now with real video capture and a video-synced tool-call track.

**Just did:** Milestone 4 — video capture + tool-call track.
- `src/protocol/video-recorder.ts` (new): prepare/finalize helpers; video start epoch captured at context creation (`offset_ms = frame_ts - startedAtEpoch`); artifacts land as `<id>.webm` in `~/.allternit/recordings/`.
- `LocalPlaywrightProvider.startRecordedSession/stopRecordedSession/getVideoArtifact`: recordVideo on a Playwright-created context (works over CDP — verified empirically on playwright 1.58.2 with chromium-1234, headless; existing Chrome-created profile tabs stay video-less by Playwright design). Session binding re-points at the recorded tab; other contexts' pages are closed so the CDP action primitives resolve the recorded tab unambiguously.
- `launcher.connectViaCDP`: prefer the first context that has pages.
- Run controller `recordArtifact` → `artifact.created` events; browser server routes `POST /v1/browser-runs/:runId/video/start|stop`.
- Python ACU core: `RecordingManifest.video_path`/`video_start_epoch`; `POST /record` accepts them at start/stop; detail route adds `video_url`; new `GET /recordings/{id}/video` (webm, same containment hardening as GIF).
- Surface: `buildToolCallTrack` pure export in recording-timeline.ts; manifest video fields parsed; `recordings.ts` client fetches video like GIF; `AciRecordingTimelineView` gains a `<video>` pane (gateway artifact or "Open video…" file picker) with bidirectional scrubbing — track click seeks the video, `timeupdate` highlights the nearest track entry; screenshot mode remains the fallback.

**Verification:** allternit-browser `tsc --noEmit` clean; package vitest 89 passed / 8 skipped (incl. new recordVideo launch+CDP smoke and full provider drive-the-recorded-tab test); surface aci vitest 50 passed (19 timeline tests incl. 7 new track-export tests); Python `test_recordings_routes.py` 20 passed (6 new video tests) via scratch uv venv at /tmp/webmcp-test-venv. Pre-existing failures noted, not introduced: surface `tsc --noEmit` has 6 missing-module errors (mermaid/yjs/storybook/immer — none in touched files); `core/tests/test_replay.py` fails identically at HEAD; one stale committed assertion in test_recordings_routes.py (`kind: "action"` in route but not test) fixed in-place.

**Next:** Parent review; session wrap (commit/PR/ledger happen outside this subagent per instructions).

**Open questions:** None.
