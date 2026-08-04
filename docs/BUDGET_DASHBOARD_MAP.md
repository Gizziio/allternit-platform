# Budget Dashboard — Gap Map

**Item:** #62 Budget Dashboard (PARTIAL → iOS)  
**Branch:** `feat/ios-budget-dashboard`  
**Reference:** web `surfaces/ai.allternit.com/src/views/runtime/BudgetDashboardView.tsx`

## Current state

- Web has a full `BudgetDashboardView`: stat cards, quota editor with quick
  presets, pressure bar, resource metrics, and alerts. Calls
  `GET /api/v1/runtime/budget` and `POST /api/v1/runtime/budget/quota`.
- iOS has no dedicated budget dashboard, only the summary card inside the
  Runtime Operations hub (#61).

## Phase 1 plan

Ship a dedicated iOS Budget Dashboard.

1. Extend `RuntimeOperationsStore` with `configuredCreditsPerHour`,
  `maxPressurePercent`, and a `setBudgetQuota(creditsPerHour:)` action.
2. Build `BudgetDashboardView.swift`: stat cards, quota text field + slider +
  quick presets, resource pressure bars, alerts list.
3. Make the Runtime Operations hub's budget card push the new dashboard.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/runtime/BudgetDashboardView.tsx`
  - `surfaces/allternit-mobile/ios/Features/Settings/RuntimeOperationsView.swift`
- Write:
  - `docs/BUDGET_DASHBOARD_MAP.md`
  - `surfaces/allternit-mobile/ios/Features/Settings/BudgetDashboardView.swift`
  - Update `surfaces/allternit-mobile/ios/Core/RuntimeOperationsStore.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Settings/RuntimeOperationsView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (uses existing `/api/v1/runtime/budget`).
- No builds/typechecks; syntax review only.
