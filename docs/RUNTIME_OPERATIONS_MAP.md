# Runtime Operations — Gap Map

**Item:** #61 Runtime Operations (GAP → iOS, gizzi-code)  
**Branch:** `feat/ios-runtime-operations`  
**Reference:** web `surfaces/ai.allternit.com/src/views/runtime/RuntimeOperationsView.tsx`

## Current state

- Web has a mature `RuntimeOperationsPanel`/`RuntimeOperationsView` hub that
  aggregates budget, replay, prewarm, and execution-mode state.
- Underlying hooks call:
  - `GET /api/v1/runtime/budget`
  - `GET /api/v1/runtime/replay/sessions` + `POST …/:run_id/execute`
  - `GET /api/v1/runtime/prewarm/status`
  - `GET/POST {runtimeBase}/runtime/execution-mode`
- iOS has no runtime operations UI.

## Phase 1 plan

Ship an iOS Runtime Operations hub that fetches all four subsystems and
summarizes them in cards. Detail views for budget/replay/prewarm are deferred
to items #62-64.

1. Add models for `RuntimeBudgetStatus`, `RuntimeBudgetMetric`,
   `RuntimeBudgetAlert`, `ReplayManifest`, `PoolStatus`, `PoolStats`,
   `PrewarmStatus`, and `RuntimeExecutionModeStatus`.
2. Add `RuntimeOperationsClient` for the four endpoint families.
3. Add `RuntimeOperationsStore` to fetch and hold hub data.
4. Build `RuntimeOperationsView.swift`: summary cards + refresh + alerts.
5. Add entry in Settings Infrastructure section next to Monitor.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/runtime/RuntimeOperationsView.tsx`
  - `surfaces/ai.allternit.com/src/hooks/useBudget.ts`
  - `surfaces/ai.allternit.com/src/hooks/useReplay.ts`
  - `surfaces/ai.allternit.com/src/hooks/usePrewarm.ts`
  - `surfaces/ai.allternit.com/src/hooks/useRuntimeExecutionMode.ts`
  - `surfaces/allternit-mobile/ios/Features/Settings/SettingsView.swift`
- Write:
  - `docs/RUNTIME_OPERATIONS_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/RuntimeOperationsModels.swift`
  - `surfaces/allternit-mobile/ios/Core/API/RuntimeOperationsClient.swift`
  - `surfaces/allternit-mobile/ios/Core/RuntimeOperationsStore.swift`
  - `surfaces/allternit-mobile/ios/Features/Settings/RuntimeOperationsView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Settings/SettingsView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (uses existing web endpoints).
- No builds/typechecks; syntax review only.
- Phase 1 is a read-only hub. Detail/management screens for budget, replay,
  and prewarm are deferred.
