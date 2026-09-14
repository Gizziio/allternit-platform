# iOS Bot Parity / CUA Driver Branch Map

**Branch:** `session/ios-bot-parity`
**Worktree:** `~/Desktop/allternit-workspace/allternit-session-ios-bot-parity`
**Goal:** Bring the branch back to a clean, reviewable state and identify the remaining work to land CUA Driver binary handling, Multica protocol alignment, and Computer History integration.

## Feature areas present in the branch

1. **CUA Driver binary handling**
   - Stop committing the Cua Driver binary to the repo.
   - Download the binary at build time instead.
   - Prefer an installed `CuaDriver.app` so Computer History works without signing Allternit Desktop.

2. **Multica production protocol alignment**
   - Align the local CLI driver with Multica production protocols.

3. **CUA Computer History integration**
   - Transport, provider, gateway, SDK, MCP, and plugin layers.

## Phase 1 resolution

- The WIP commit contained real work and was split into API, bridge/web, and iOS commits.
- Current `origin/main` was merged and all conflicts were resolved.
- Consolidation-only steering history was excluded from the feature commits.

## Representative changed files

- API ledger: `cmd/allternit-api/migrations/V93__bot_events.sql`, `cmd/allternit-api/src/bot_event_routes.rs`, and required router/AppState wiring under `cmd/allternit-api/src/`.
- Runtime/web bridge: `cmd/gizzi-code/src/runtime/services/agent-event-bridge.ts` and `surfaces/ai.allternit.com/src/lib/bots/`.
- Native iOS parity: `surfaces/allternit-mobile/ios/Core/`, `Features/Agents/Desktop/`, `Features/Settings/WebhooksSettingsView.swift`, Live Activities, audit flows, and Xcode project registration.

## Success criteria

- [x] WIP commit split into coherent commits.
- [x] `origin/main` merged and conflicts resolved.
- [x] MAP/NOTES identify changed feature areas and remaining Phase 2 work.
- [x] Cleaned branch pushed to `origin/session/ios-bot-parity` as the final Phase 1 action.
