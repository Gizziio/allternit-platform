# Monitor — Gap Map

**Item:** #60 Monitor (GAP → iOS)  
**Branch:** `feat/ios-monitor`  
**Reference:** web `surfaces/ai.allternit.com/src/views/MonitorView.tsx`

## Current state

- Web `MonitorView.tsx` calls `/api/v1/monitor/agents`, `/api/v1/monitor/logs`,
  and `/api/v1/monitor/system`.
- No backend routes for `/monitor/*` exist in the current API.
- iOS has no Monitor UI at all.

## Phase 1 plan

Ship the iOS Monitor UI wired to the same endpoints; it will render live data
once the backend routes are implemented, and show a clean empty/error state
until then.

1. Add `MonitorAgent`, `MonitorLogEntry`, and `MonitorSystemMetric` models
   matching the web shapes.
2. Add `MonitorClient` for the three `/api/v1/monitor/*` endpoints.
3. Add `MonitorStore` to fetch and hold monitor data.
4. Build `MonitorView.swift`: system metrics, quick stats, Agents/Logs tabs.
5. Add a "Monitor" row to Settings as an entry point.

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/MonitorView.tsx`
  - `surfaces/allternit-mobile/ios/Features/Settings/SettingsView.swift`
- Write:
  - `docs/MONITOR_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/MonitorModels.swift`
  - `surfaces/allternit-mobile/ios/Core/API/MonitorClient.swift`
  - `surfaces/allternit-mobile/ios/Core/MonitorStore.swift`
  - `surfaces/allternit-mobile/ios/Features/Settings/MonitorView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Settings/SettingsView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (the web already assumes these routes).
- No builds/typechecks; syntax review only.
- Phase 1 is read-only monitoring UI. Agent control actions (pause/resume/
  restart) are button shells without handlers.
