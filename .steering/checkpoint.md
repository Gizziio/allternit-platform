# Steering checkpoint

## Goal

Automation Tasks (iOS) Phase 2: build Routines as an iOS sibling surface to
the already-shipped Phase 1 cron implementation, backed by the already-existing
`v1/automations/routines` backend (no backend changes). Spec:
`docs/AUTOMATION_TASKS_PHASE_2_TASK.md`.

## Just did

- Read the full backend route handlers (`cmd/gizzi-code/src/runtime/server/
  routes/automations.ts:104-225`) and `routine-engine.ts` to confirm exact
  wire shapes before writing any Swift, per the task spec's "verify by
  reading the code, not assumed" instruction.
- Built the Routines equivalents of every Phase 1 cron file, as siblings:
  - `Core/API/Models/Routine.swift` — `RoutineStep` (`Codable`, used both
    directions), `Routine` (`Decodable` only, matching `CronJob`/`CronRun`'s
    decode-only convention) with explicit `CodingKeys` for the routine row's
    snake_case wire (`agent_id`, `time_created`, `time_updated` as ms-epoch
    `Double`) — correctly diverging from cron's camelCase/ISO-8601 wire.
  - `Core/API/RoutinesClient.swift` — mirrors `CronClient` exactly: direct
    `AppConfig.gizziCodeBaseURL`, route-line-number doc comments,
    `Self.escape(id)` helper. Only implements the endpoints actually used
    (`listRoutines`, `createRoutine`, `runRoutine`, `deleteRoutine`) — no
    `PUT`/update method, since nothing in scope needs it.
  - `Core/RoutineStore.swift` — `@MainActor final class RoutineStore:
    ObservableObject`, `@Published private(set)` state, same
    fetch-if-needed/refresh/mutate-then-refresh pattern as `CronJobStore`
    (needed here too: `PUT`/`run` return `{success:true}` not the row, and
    there's no `GET /routines/:id`, so every mutation refetches the whole
    list).
  - `Features/Automation/Views/RoutinesListView.swift`,
    `RoutineDetailView.swift`, `CreateRoutineSheet.swift` — mirror the cron
    views' structure with the spec'd differences: no schedule-required
    validation on create, no run-history section (step list stands in),
    only Run + Delete actions (no pause/resume — no such endpoint).
- Wired nav: added `AppModeStore.automationKind` (`Core/AppMode.swift`) and
  an identical Cron/Routines segmented `Picker` bound to it at the top of
  both `AutomationTasksListView` and `RoutinesListView`; `ChatView.swift`'s
  `.automation` case switches on it. No new top-level nav item — both
  surfaces reachable from the existing "Automation Tasks" tab.
- Verified: `swift -frontend -parse` clean on all 9 touched files (6 new, 3
  modified). No Xcode build/simulator run or live-server QA, per task
  constraints — response shapes verified by reading source only.
- Wrote deliverable `docs/AUTOMATION_TASKS_PHASE_2_NOTES.md` (frontmatter +
  prose) documenting files changed, deviations, and remaining gaps.
- Steering review (independent re-verification against the real TS route
  handlers): all wire-shape and behavior claims confirmed exact; nav wiring
  confirmed symmetric in both files. No code findings — only flagged that
  this checkpoint/spec were stale (still describing an unrelated prior
  memory-agent task). Fixed by rewriting both files for this task.

## Files changed

- `surfaces/allternit-mobile/ios/Core/API/Models/Routine.swift` (new)
- `surfaces/allternit-mobile/ios/Core/API/RoutinesClient.swift` (new)
- `surfaces/allternit-mobile/ios/Core/RoutineStore.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/RoutinesListView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/RoutineDetailView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/CreateRoutineSheet.swift` (new)
- `surfaces/allternit-mobile/ios/Core/AppMode.swift`
- `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift`
- `surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift`
- `docs/AUTOMATION_TASKS_PHASE_2_NOTES.md` (new, deliverable)
- `.steering/checkpoint.md`, `.steering/spec.md` (this update)

## Known follow-ups

- No Xcode build/simulator run performed (excluded by task constraints — the
  orchestrator validates separately if needed).
- No manual QA against a running gizzi-code server.
- No git operations performed (no commit/push/PR) — per task constraints,
  the orchestrator handles that after review.
- Loops and Goals (Phase 3/4) remain untouched, as scoped.
