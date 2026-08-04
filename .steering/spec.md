# Steering spec — Automation Tasks (iOS) Phase 2: Routines

Source: `docs/AUTOMATION_TASKS_PHASE_2_TASK.md`. Backend already exists
(`v1/automations` routines routes, `cmd/gizzi-code/src/runtime/server/routes/
automations.ts:104-225`) — this phase is iOS-only, mirroring the Phase 1
cron implementation.

## Requirements

- [x] R1: WHEN the Automation Tasks tab loads Routines, THE SYSTEM SHALL
  fetch `GET v1/automations/routines` via a dedicated `RoutinesClient`
  connecting directly to `AppConfig.gizziCodeBaseURL` (same host as
  `CronClient`/`PtyClient`/`PermissionClient`, NOT the `allternit-api` relay
  `ProjectsClient` uses), and decode the bare array response with correct
  wire shape: snake_case keys (`agent_id`, `time_created`, `time_updated`)
  and ms-epoch numeric timestamps, unlike cron's camelCase/ISO-8601 wire.
- [x] R2: WHEN a user creates a routine, THE SYSTEM SHALL POST
  `v1/automations/routines` with `{ name, steps, trigger?, schedule? }` where
  only `name` is required (unlike cron, schedule is NOT mandatory — a
  routine can be run manually) and steps is an optional list of
  `{command, status: "pending"}`.
- [x] R3: WHEN a user taps Run on a routine, THE SYSTEM SHALL POST
  `v1/automations/routines/:id/run` (no body, fire-and-forget server-side)
  and refresh the list afterward to pick up the server-driven `state`/step
  status changes — the response is discarded, matching the "returns success,
  not the row" asymmetry already handled by `CronJobStore`.
- [x] R4: WHEN a user taps Delete on a routine, THE SYSTEM SHALL DELETE
  `v1/automations/routines/:id` and remove it from local state.
- [x] R5: THE SYSTEM SHALL NOT implement pause/resume actions for routines
  (no such endpoint exists) and SHALL NOT implement a run-history
  view/endpoint call (no `/routines/:id/runs` exists) — the detail view
  shows current `state` and per-step `status` from the already-fetched list
  item instead, refetching the whole list after mutations (no
  `GET /routines/:id` exists either).
- [x] R6: THE SYSTEM SHALL surface Routines as a sibling entry point of the
  existing Cron view within the same "Automation Tasks" tab (no new
  top-level nav item), discoverable in both directions.
- [x] R7: THE SYSTEM SHALL NOT touch Loops or Goals (Phase 3/4, out of
  scope) or make any backend changes.
- [x] R8: Swift files SHALL mirror the Phase 1 cron files' structure,
  naming, property-wrapper choice (`ObservableObject`/`@Published`, not
  `@Observable`), and error/loading-state conventions exactly, as sibling
  files: `RoutinesClient.swift`, `Models/Routine.swift`, `RoutineStore.swift`,
  `RoutinesListView.swift`, `RoutineDetailView.swift`, `CreateRoutineSheet.swift`.

## Acceptance (Gherkin)

- Scenario: Routines list loads with correct wire shape
  Given `GET v1/automations/routines` returns a bare array of routine rows
  with snake_case keys and ms-epoch timestamps
  When `RoutinesListView` appears
  Then `RoutineStore.fetchRoutinesIfNeeded()` decodes it into `[Routine]`
  without a decoding error.
- Scenario: Create requires only a name
  Given a user fills in only "Name" and leaves steps/trigger/schedule blank
  When they tap Create
  Then `POST v1/automations/routines` is sent with `{name, steps: []}` and
  `trigger`/`schedule` omitted (not null-encoded).
- Scenario: Run refreshes instead of trusting the response
  Given a routine in state "defined"
  When Run is tapped
  Then `POST .../run` is called, its response is discarded, and
  `RoutineStore.refresh()` re-fetches the list so `state` becomes "running".
- Scenario: No pause/resume/run-history affordances exist
  Given `RoutineDetailView` is rendered
  Then only "Run Now" and "Delete" actions are present, and the view shows
  `liveRoutine.steps` with per-step status instead of a runs list.
- Scenario: Routines discoverable from Cron and vice versa
  Given a user is on `AutomationTasksListView` (Cron)
  When they tap the "Routines" segment
  Then `ChatView`'s `.automation` case renders `RoutinesListView`, and the
  same segmented control there can flip back to Cron.

## Verification status

- `swift -frontend -parse` clean on all 6 new files + 3 modified files
  (`AppMode.swift`, `ChatView.swift`, `AutomationTasksListView.swift`).
- No Xcode build / simulator run (excluded by task constraints).
- No live gizzi-code server QA — response shapes verified by reading
  `automations.ts` and `routine-engine.ts` source directly, confirmed
  independently by the steering agent against the same source.
- Deliverable notes at `docs/AUTOMATION_TASKS_PHASE_2_NOTES.md`.
