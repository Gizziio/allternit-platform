# Steering checkpoint

**Goal:** WebMCP-shaped tool layer over gmail/github/notion plugin golden paths + semantic tool-call logging + timeline playback viewer (real video as later phase). Value-first: no bet on native WebMCP adoption.

**Just did:** Milestone 1 implemented in worktree `allternit-session-webmcp-play` (branch `session/webmcp-playback`), left uncommitted for owner review per instructions:
- Protocol: `SiteToolDescriptorSchema` / `SiteToolCallSchema` / `SitePluginManifestSchema`, `tool.called` event type, trajectory step union (`action` | `tool_call`) in `packages/@allternit/computer-use-protocol/src/index.ts` (+10 schema tests, typecheck+build green).
- New `allternit-browser/src/browser/site-tools/`: `registry.ts` (wildcard domain match, blocked-action refusal at tool boundary), `bridge.ts` (`window.__allternitSiteTools`, navigator.modelContext probe optional-only), `resolver.ts` (site-tool → dom-refs → vision ordering), `adapters/{common,gmail,github,notion}.ts` (real plugin.json manifests + cookbook selectors driving existing actions.ts primitives).
- `run-controller.ts`: `siteTools` + `resolveToolContext` options, `availableTools(runId)` (origin-gated descriptor surfacing), `executeTool` (lease-checked, origin-checked, SiteToolCall latency/error logging as `tool.called` event, tool_call trajectory steps interleaved via step log). Routes: `GET/POST /v1/browser-runs/:runId/tools[/:toolName]`.
- Verification so far: protocol typecheck+10 tests green; browser package typecheck green; 43 new unit tests green; full package suite 81 passed / 8 pre-existing skips, 0 regressions.
- Note: dir named `site-tools/` (plan said `tools/`); adapters resolve plugin.json by walking up to repo root (same pattern as gizzi-code browser.ts), env override `ALLTERNIT_PLUGINS_DIR`.

**Next:** Headless-Chromium live smoke (github.review_pr against local fixture with fake navigator.modelContext; blocked by playwright chromium-1208 download in progress — cache only had 1148/1223/1228/1234). Then final report to owner.

**Open questions:** None.
