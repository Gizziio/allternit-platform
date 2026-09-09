# Session attestation — 2026-09-09 11:11 — session/webmcp-playback — kimi — webmcp-site-tools-playback

## What was done

Built the WebMCP-shaped site-tools layer + semantic tool-call logging + video/timeline playback, across four milestones, on branch `session/webmcp-playback`. Merged as PR #214 (merge commit `93e8b3d09`).

Owner's framing (approved plan): native WebMCP is worth ~nothing today (no sites implement it; Chrome's API is flag-gated), so value comes from wrapping the existing gmail/github/notion plugin golden paths as structured callable tools with enforced `blocked_actions`, logging those calls into session recordings, and scrubbing recordings (frames → video) against a named tool-call track. Tool surface is WebMCP-*compatible* (name/description/inputSchema + in-page `window.__allternitSiteTools` bridge with an optional `navigator.modelContext` capability probe) so the standard is a free upgrade later, not a dependency now.

1. **TS site-tools** (`infrastructure/chrome-stream/agent-systems/allternit-browser/`): `SiteToolCall` schema + `tool_call` trajectory step in `@allternit/computer-use-protocol`; registry/bridge/resolver; gmail/github/notion adapters derived from `domains/computer-use/core/plugins/*/plugin.json` + cookbooks, handlers driving only existing `browser/playwright/actions.ts` primitives; run-controller preference order site-tool → DOM refs → vision; `tool.called` events; `GET /v1/browser-runs/:id/tools` + POST invoke. Fixed a real CDP context-discovery race in `connectViaCDP` (fresh connections could report zero contexts and strand actions on an empty incognito context → observed as `waitForSelector` timeouts).
2. **Python parity** (`domains/computer-use/core/`): `browser.webmcp` adapter + bridge client (experimental; deliberately NOT added to the automatic routing matrix in `routing/__init__.py`); `ToolCallFrame` (`_type: "tool_call"`) in `action_recorder.py` with arg redaction reusing `trajectory_export` policy; old recordings without `_type` still deserialize. No changes needed in `routing/registry.py`/`capability_matrix.py` (rglob discovery).
3. **Timeline viewer** (`surfaces/ai.allternit.com/src/views/aci/`): `AciRecordingTimelineView` + `recording-timeline.ts` parser (both frame types; lenient on bad lines); bidirectional scrubbing; gateway JSONL transport (`/v1/computer-use/recordings/{id}/file`) with file-picker fallback; nav/registry wiring following the mini-app-review-console pattern. Fixed `_frame_to_step` in `computer_use_router.py`, which would have 500'd on tool_call frames.
4. **Video + tool-call track**: `recordVideo` verified empirically to work over `chromium.connectOverCDP` in Playwright 1.58.2 **for Playwright-created contexts** (headless smoke evidence, `.webm` produced); externally-created profile tabs stay video-less by Playwright design. Artifacts → `~/.allternit/recordings/<id>.webm`; manifest `video_path`/`video_start_epoch`; `GET /recordings/{id}/video` (same regex+containment hardening as the GIF route); `POST /v1/browser-runs/:id/video/start|stop`; `buildToolCallTrack` offset export; `<video>` pane in the viewer with the same bidirectional scrubbing.

## How it works (30 seconds)

A run on an allowed origin (e.g. github.com) surfaces matching site-tool descriptors to the model before ref-based actions. The model/caller invokes `github.review_pr` etc. via the controller; the registry refuses plugin-blocked actions at the boundary; handlers execute golden-path steps through the shared Playwright-over-CDP primitives; every invocation is emitted as a `tool.called` event and recorded as a `tool_call` frame (Python gateway) with timestamp, so the viewer can lay the calls over screenshots or the session `.webm`.

## Verification evidence

- allternit-browser: `npx tsc --noEmit` clean; `npx vitest run` → 89 passed / 8 skipped (16 files), incl. live headless smokes: fixture page + fake `navigator.modelContext`, real `github.review_pr` handler drove the real browser (form submitted, text typed), `tool.called` in the event stream, `tool_call` step in trajectory; recordVideo launch + CDP + full-provider smokes produced non-empty `.webm`.
- computer-use core: `tests/test_webmcp.py` 11 passed; `tests/test_recordings_routes.py` 20 passed (scratch uv env, deleted after).
- surface: `vitest run src/views/aci` → 50 passed (19 timeline tests).
- Playwright CDN note: pinned build chromium-1208 was pulled from the CDN (GatewayServiceFileDetails error); tests resolve a binary via `ALLTERNIT_CHROMIUM_PATH` → pinned → newest cached `chromium-*` (1234 works).

## Pre-existing breakage (verified identical at base/HEAD via stash, NOT introduced here)

- Surface `tsc --noEmit`: 6 missing-module errors (mermaid, yjs, @storybook/test, immer, blocksuite shim) — absent from the machine's installed node_modules.
- `core/tests/test_replay.py` fails in this environment (missing pytest-asyncio / session fixtures).
- Fixed one stale committed assertion in `test_recordings_routes.py` (`kind: "action"` emitted by route but missing in test).

## Incidents

- Two coder subagent timeouts (2h each) during Milestone 1 — caused by the stalled chromium-1208 download (CDN copy pulled) and a slow pnpm install; recovered by finishing verification in the main session. Peer-hash churn in pnpm-lock.yaml from the install was reverted (no spec changes).
- Steering checkpoint conflict with a parallel session (bot-computer-panel) merged keeping ours; file is per-session scratch.

## Honest deferrals

- Native WebMCP discovery beyond the capability probe — nothing to discover on the live web yet.
- Auto-generated adapters for arbitrary sites (framework supports it; deliberately unshipped).
- Python planning-loop resolver preference wiring (adapter is callable; preference ordering currently TS-side only).
- TS↔Python video manifest sync is a caller contract (`POST /record` accepts the fields), not automatic glue.
- No dev-server/browser click-through smoke of the viewer; verified via tests + parser/route coverage only.
