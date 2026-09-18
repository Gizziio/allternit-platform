---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/Models/Routine.swift
  - surfaces/allternit-mobile/ios/Core/API/RoutinesClient.swift
  - surfaces/allternit-mobile/ios/Core/RoutineStore.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/RoutinesListView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/RoutineDetailView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/CreateRoutineSheet.swift
  - surfaces/allternit-mobile/ios/Core/AppMode.swift
  - surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift
deviations:
  - "No RoutinesClient.updateRoutine()/PUT method. The spec's UI-differences section only calls for Run and Delete actions on the detail view (no edit, no state-setting UI) — PUT /v1/automations/routines/:id exists on the backend but nothing in the iOS surface needs to call it, so it was left unimplemented rather than added as unused surface."
  - "Nav wiring implemented as a segmented control (Cron | Routines) rendered identically at the top of both AutomationTasksListView and RoutinesListView, bound to a new AppModeStore.automationKind published property, rather than a second tab in ModeBarItem. This was the spec's own suggested option ('e.g., a segmented control or second tab') and keeps both list views full standalone siblings (own header/sidebar-toggle/create-sheet) while making each discoverable from the other without adding a new top-level nav entry."
  - "CreateRoutineSheet's steps input is a dynamic array of single-line command TextFields (add/remove rows) rather than a single multiline field, since steps are structured {command,status} objects, not free text — this isn't a literal mirror of any single cron sheet field but follows the same fieldBubble visual language."
remaining:
  - "Not built/run in Xcode or a simulator (per the no-build constraint). Sanity-checked with `swift -frontend -parse` on every new/modified file — no syntax errors. Type-level and cross-file correctness (e.g. environment object propagation, SwiftUI modifier chains) were verified by reading, not by compiling."
  - "No manual QA against a running gizzi-code server — response shapes were verified by reading routes/automations.ts and routine-engine.ts, not by hitting the endpoints."
---

## What was built

Routines equivalents of every Phase 1 cron file, as sibling files in the same locations, plus the minimum nav wiring to make Routines discoverable from the existing Automation Tasks tab.

### Backend routes/shapes verified by reading the code

All from `cmd/gizzi-code/src/runtime/server/routes/automations.ts`:

- `GET /v1/automations/routines` (lines 104-121): returns `db.select().from(RoutineTable).all()` directly via `c.json(rows)` — bare array, no envelope. Confirmed no pagination/filtering.
- `POST /v1/automations/routines` (lines 122-153): validated against `RoutineCreateSchema` (lines 15-22) — `{ id?, agent_id?, name, steps?: {command,status}[] (default []), trigger?, schedule? }`. The inserted row (lines 139-150) is `{ id, agent_id, name, steps, trigger, schedule, state: "defined", time_created: Date.now(), time_updated: Date.now() }` and is returned verbatim as the 201 body — so the response's field names are the literal JS object keys, i.e. **snake_case** (`agent_id`, `time_created`, `time_updated`), unlike cron's hand-serialized camelCase wire. `Routine.swift` uses explicit `CodingKeys` to map this; `Routine.timeCreated`/`timeUpdated` are decoded as `Double` (ms-epoch, `Date.now()`), not ISO-8601 strings like cron's `createdAt`/`updatedAt`.
- `PUT /v1/automations/routines/:id` (lines 154-182): `RoutineUpdateSchema` (lines 24-31), all fields optional including `state`. Returns `{ success: true }` only — confirmed by reading the handler (`c.json({ success: true })`), no row echoed back. Not called by this build (see deviations).
- `DELETE /v1/automations/routines/:id` (lines 183-200): returns `{ success: true }`.
- `POST /v1/automations/routines/:id/run` (lines 201-225): no request body. Sets `state: "running"` in the DB, calls `RoutineEngine.startRoutine(id).catch(console.error)` fire-and-forget, then responds `{ success: true, state: "running" }` immediately — the actual step execution happens asynchronously after the response returns. `RoutinesClient.runRoutine` discards the response body and `RoutineStore.runRoutine` refreshes the list afterward, same pattern as `CronJobStore.pause/resume`.

`routine-engine.ts` (read in full) confirmed the state machine used for status colors/labels: `state` moves `defined -> running -> completed | failed` (set at lines 12, 64-74); each step's `status` moves `pending -> running -> done | failed` (lines 26-46), driven sequentially by `runStep` spawning `command` in a shell. No route returns run history — the routine row's own `steps[].status` is the only progress signal, confirmed by grepping `automations.ts` for a `/runs` path (none exists for routines, unlike cron's `/jobs/:id/runs`).

### iOS files

- `Core/API/Models/Routine.swift` — `RoutineStep` (`Codable`, used both directions: decoded in `Routine.steps`, encoded in `CreateRoutineRequest.steps`), `Routine` (`Decodable` only, matching `CronJob`/`CronRun`'s decode-only convention since nothing re-encodes a fetched routine), `CreateRoutineRequest`.
- `Core/API/RoutinesClient.swift` — mirrors `CronClient`'s shape exactly: direct `AppConfig.gizziCodeBaseURL` connection, doc comments citing route + line numbers, `Self.escape(id)` percent-encoding helper, one method per endpoint actually used (`listRoutines`, `createRoutine`, `runRoutine`, `deleteRoutine`).
- `Core/RoutineStore.swift` — `@MainActor final class RoutineStore: ObservableObject` with `@Published private(set)` state, matching `CronJobStore`'s exact property-wrapper choice (checked: `CronJobStore` uses `ObservableObject`/`@Published`, not the `@Observable` macro, so `RoutineStore` follows suit). Same `fetchRoutinesIfNeeded(force:)` / `refresh()` / mutate-then-refresh pattern, since Routines' `PUT`/`run` share cron's "returns success, not the row" asymmetry — `RoutineStore` never assumes a mutation response is the updated record; it always refetches the whole list, which is also how it necessarily works around there being no `GET /routines/:id`.
- `Features/Automation/Views/RoutinesListView.swift`, `RoutineDetailView.swift`, `CreateRoutineSheet.swift` — mirror `AutomationTasksListView`/`AutomationTaskDetailView`/`CreateAutomationTaskSheet` structurally (header chrome, search, row → detail push, field-bubble creation form, loading/empty/error states), with the routine-specific differences called out in the task spec: no schedule-required validation on create (`canCreate` only requires `name`), no run-history list/section (the step list stands in, refetched via the same whole-list `refresh()`), and only Run + Delete actions in the detail view (no pause/resume — there's no such endpoint).

### Nav wiring

`ModeBarItem.automation` (the existing single "Automation Tasks" sidebar tab, `Core/AppMode.swift`) is unchanged — no new top-level nav item was added, per the constraint against inventing an unrelated entry point. Instead:

- `AppModeStore` gained `@Published var automationKind: AutomationKind = .cron` (`Core/AppMode.swift`), and a new `AutomationKind` enum (`.cron`, `.routines`).
- `ChatView.swift`'s `.automation` case now switches on `modeStore.automationKind` to render either `AutomationTasksListView` or `RoutinesListView`.
- Both list views render an identical `Picker(..., selection: $modeStore.automationKind)` segmented control directly below their header (above the cron-only status filter / routines search box), so a user on either screen can flip to the other with one tap — both surfaces are discoverable from the same "Automation Tasks" entry point, as required.
