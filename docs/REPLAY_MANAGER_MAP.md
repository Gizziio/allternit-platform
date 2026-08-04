# Replay Manager — Gap Map

**Item:** #63 Replay Manager (GAP → iOS, gizzi-code)  
**Branch:** `feat/ios-replay-manager`  
**Reference:** web `surfaces/ai.allternit.com/src/views/runtime/ReplayManagerView.tsx`

## Current state

- Web `ReplayManagerView` calls `GET /api/v1/runtime/replay/sessions` and
  `POST /api/v1/runtime/replay/sessions/:run_id/execute`.
- iOS has no replay manager UI; only a summary card in Runtime Operations
  hub (#61).

## Phase 1 plan

Ship a dedicated iOS Replay Manager.

1. Build `ReplayManagerView.swift`: search, capture-level filter, stat cards,
   manifest list with per-row Replay action.
2. Add `executeReplay(runId:)` to `RuntimeOperationsStore`.
3. Make the Runtime Operations hub's replay card push the manager.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/runtime/ReplayManagerView.tsx`
  - `surfaces/allternit-mobile/ios/Features/Settings/RuntimeOperationsView.swift`
- Write:
  - `docs/REPLAY_MANAGER_MAP.md`
  - `surfaces/allternit-mobile/ios/Features/Settings/ReplayManagerView.swift`
  - Update `surfaces/allternit-mobile/ios/Core/RuntimeOperationsStore.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Settings/RuntimeOperationsView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (uses existing `/api/v1/runtime/replay/*`).
- No builds/typechecks; syntax review only.
