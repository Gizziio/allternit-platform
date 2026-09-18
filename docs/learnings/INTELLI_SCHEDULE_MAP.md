# iOS Intelli-Schedule panel — Gap Map

**Item:** #18 Intelli-Schedule panel (GAP → iOS)  
**Branch:** `feat/ios-intelli-schedule`  
**Reference:** gizzi-code `cmd/gizzi-code/src/scheduler/IntelliScheduleEngine.ts`, web `surfaces/ai.allternit.com/src/lib/intelli-schedule/IntelliScheduleEngine.ts`

## Current state

- gizzi-code has a real `IntelliScheduleEngine` that optimizes task ordering given priority, estimated minutes, deadlines, dependencies, and daily-hour constraints.
- Web has an equivalent engine but the panel UI is dead/unreachable.
- iOS has zero Intelli-Schedule code.

## Phase 1 plan

1. Port `IntelliScheduleEngine` to Swift (`IntelliScheduleEngine.swift`).
   - Same algorithm: sort by (-blockingCount, deadline, -priority, estimatedMinutes, id), then allocate across days.
   - Output: ordered task IDs + schedule entries (start/end/risk) + unrunnable IDs.
2. Add `IntelliScheduleStore` that fetches tasks via the existing `CoworkTasksClient` and runs the engine.
3. Build `IntelliSchedulePanel` view:
   - Task list in optimized order
   - Each row shows title, estimated minutes, scheduled start/end, risk dot
   - Segmented control for strategy (greedy is phase 1; later strategies deferred)
4. Add entry point from the existing Cowork workspace or from the Cowork top deck.

## Files

- Read:
  - `cmd/gizzi-code/src/scheduler/IntelliScheduleEngine.ts`
  - `surfaces/allternit-mobile/ios/Core/API/CoworkTasksClient.swift`
  - `surfaces/allternit-mobile/ios/Core/API/Models/CoworkTask.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkTasksListView.swift`
- Write:
  - `surfaces/allternit-mobile/ios/Core/IntelliScheduleEngine.swift`
  - `surfaces/allternit-mobile/ios/Core/IntelliScheduleStore.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/IntelliSchedulePanel.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift` or `CoworkTopDeck` to add an entry button.

## Constraints

- Match iOS conventions (colors, fonts, SF Symbols).
- Reuse `CoworkTasksClient` and `CoworkTask` models.
- No backend changes.
- No builds/typechecks; `swiftc -parse` only.
