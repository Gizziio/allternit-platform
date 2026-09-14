# Fabric transport — legacy fallback removed, gateway routes live

**Date:** 2026-08-29  
**Agent:** Kimi Code CLI  
**Scope:** Transport / Capability Fabric (iOS client + Allternit API gateway + Gizzi runtime)

---

## Summary

Completed the server-side transport layer and removed the legacy `/api/agent-chat` fallback from iOS. The capability-native Fabric path is now the only chat streaming path on iOS.

---

## What was done

### iOS client

- Removed the legacy `POST /api/agent-chat` fallback from `AgentChatClient`.
  - Deleted `AgentChatRequest`, `RequestMetadata`, `chatURL`, and `streamViaLegacyAgentChat`.
  - `sendMessageStream` now fails fast with `AgentChatClientError.noReachableNode` when no runtime node resolves.
- Removed `AppConfig.agentChatURL` and `AppConfig.fabricSessionWorkerEnabled`.
- Fixed `SessionWorkerClient` event mapping:
  - `PartInfo` now decodes `callID` and nested `state.status` for tool parts.
  - `message.part.updated` with `type: "tool"` maps to `toolCall`/`toolResult`/`toolError` based on `state.status`.
  - Text/reasoning deltas are distinguished by `field: "text"` / `field: "reasoning"`.

### Gizzi runtime

- Changed reasoning/thinking `PartDelta` events to emit `field: "reasoning"` instead of `field: "text"` (`cmd/gizzi-code/src/runtime/session/processor.ts`).
- Existing `/v1/fabric/*` and `/v1/session-worker/*` routes remain mounted and functional.

### Allternit API gateway

- Added `cmd/allternit-api/src/fabric_routes.rs` with Clerk-protected proxy routes:
  - `GET  /api/v1/fabric/peers`
  - `POST /api/v1/fabric/leases`
  - `POST /api/v1/session-worker/invoke`
  - `GET  /api/v1/session-worker/sessions/:id/events`
- Declared the module in `cmd/allternit-api/src/lib.rs`.
- Mounted the router in `cmd/allternit-api/src/main.rs` under `/api/v1`.

### Documentation

- Updated `/Users/joe/Downloads/TRANSPORT_CAPABILITY_DONOR_HANDOFF.md`.
- Appended section 15 to `/Users/joe/Downloads/ALLTERNIT_CANONICAL_CONVERGENCE_HANDOFF_v2.md`.

---

## Tests run

| Test | Result |
|---|---|
| `cargo check -p allternit-api` | Passed (pre-existing warnings only) |
| `bun run typecheck` (cmd/gizzi-code) | Pre-existing SDK dist errors only |
| `swiftc -parse` on changed/new iOS files | Passed |
| `pnpm --filter @allternit/os-contracts test` | 6/6 passed |

---

## Remaining work

1. Route gateway Fabric/session-worker requests to the active runtime backend preference (currently proxies to local `gizzi_base()`).
2. Forward `agentId`, `systemPrompt`, `runtimeModelId`, `effort`, and `tools` through the Fabric path.
3. Replace local/dev lease authority with canonical AllternitOS lease authority.
4. Back `NodeDirectory` with a canonical capability directory.
5. Migrate Web/Desktop away from remote-control terminology.
6. Gizzi runtime/product split and worker manifest.
7. Live end-to-end test.
