# Steering checkpoint

**Goal:** WebMCP-shaped tool layer over gmail/github/notion plugin golden paths + semantic tool-call logging + timeline playback viewer.

**Just did:** Milestone 1 committed on session/webmcp-playback — TS site-tools layer (protocol schemas, registry/bridge/resolver, gmail/github/notion adapters from plugin manifests, run-controller preference ordering, tool.called events, HTTP routes), plus a CDP context-discovery race fix in launcher.ts. 40 new tests green, full package suite 84 passed, typecheck clean. Fixed en route: Playwright CDN pulled chromium-1208 (smoke test now falls back to newest cached build via ALLTERNIT_CHROMIUM_PATH override); smoke fixture had an invisible empty div.

**Next:** Milestone 2 — Python ACU parity: webmcp adapter dir + manifest in domains/computer-use/core/adapters/browser/, registry/capability-matrix wiring, action_recorder tool_call frames, bridge client.

**Open questions:** None.
