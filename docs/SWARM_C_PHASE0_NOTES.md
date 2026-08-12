---
status: done
files_changed: []
deviations: []
remaining: []
---

# Swarm C Phase 0 Notes

Phase 0 adds `web_search` and `web_fetch` as native model-facing Tool Belt tools. Search supports cached, indexed, and live modes, with injectable index/live implementations for hosts and deterministic offline tests. Fetch accepts HTTP(S) URLs, extracts readable text from HTML, and enforces a configurable output limit.

The tool contract now supports namespaces, recursive strict-mode JSON Schema normalization, and runtime input validation. MCP servers can be attached directly to a `NativeToolBelt`; their discovered tools are exposed under a server namespace, receive strict schemas, and proxy execution back to the attached MCP client.

Focused verification passed with 8 tests and 25 assertions in `tool-belt.test.ts`. The tests cover all web search modes, HTML extraction, namespaces, strict validation, MCP discovery/attachment, deferred activation, and session rehydration. No external services were used.

There were no implementation blockers. The map named the Rust provider/gateway and MCP directories as starting points, but the model-facing Tool Belt itself lives in the TypeScript AI runtime, so changes were intentionally limited to that SDK surface and its existing tests.

The requested Git commit could not be created in this session. This linked worktree stores its index under `/Users/joe/Desktop/allternit-workspace/allternit/.git/worktrees/allternit-parity-swarm-c/`, which the active filesystem policy exposes read-only; `git add` failed with `Operation not permitted` before staging any files. The completed changes remain in the `ao/swarm-c` working tree.

Phase 1 can build on these primitives with production search-index adapters, cache persistence/expiry, richer content extraction, MCP lifecycle detach/refresh, and broader provider-specific strict-schema compatibility.
