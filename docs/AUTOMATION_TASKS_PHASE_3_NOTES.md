---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/Models/Loop.swift
  - surfaces/allternit-mobile/ios/Core/API/LoopsClient.swift
  - surfaces/allternit-mobile/ios/Core/LoopStore.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/LoopsListView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/LoopDetailView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/CreateLoopSheet.swift
  - surfaces/allternit-mobile/ios/Core/AppMode.swift
  - surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift
  - surfaces/allternit-mobile/ios/Features/Automation/Views/RoutinesListView.swift
deviations:
  - "No LoopsClient.updateLoop()/PUT method — same reasoning as Phase 2's omitted RoutinesClient.updateRoutine(): the spec's UI scope is Restart + Delete only, nothing calls PUT."
  - "AutomationTasksListView.swift and RoutinesListView.swift were touched, but only for their doc comments (updated 'Cron/Routines segmented control' references to 'Cron/Routines/Loops' for accuracy) — no code changes. The task spec predicted the `ForEach(AutomationKind.allCases...)` picker in both files would generalize to a third segment automatically without edits, and reading the actual code confirmed that: both already iterate `AutomationKind.allCases` generically rather than hardcoding two cases, so adding `.loops` to the enum was sufficient."
  - "LoopDetailView's Restart button is disabled (not hidden) while state == \"running\", with its label swapping to \"Running…\" — chosen over hiding it outright so the action row's layout doesn't jump between states, and because the task spec explicitly notes the endpoint itself doesn't reject a redundant call, so disabling (a client-side UX guard) rather than removing felt like the right weight."
  - "CreateLoopSheet's max_iterations field is a SwiftUI Stepper (1...100 range, default 10) rather than a bare numeric TextField, per the task spec's explicit instruction ('use a stepper or numeric field, not free text, since the backend field is a number')."
remaining:
  - "Not built/run in Xcode or a simulator (per the no-build constraint). Sanity-checked with `swift -frontend -parse` on all 6 new files and all 4 modified files — no syntax errors."
  - "No manual QA against a running gizzi-code server — response shapes verified by reading routes/automations.ts (lines 228-344) and loop-engine.ts (full file) directly, not by hitting the endpoints."
  - "Goals (Phase 4) untouched, as scoped."
---

## What was built

Loops equivalents of every Phase 2 routine file, as sibling files in the same locations, following the exact conventions established in Phase 2 (`docs/AUTOMATION_TASKS_PHASE_2_NOTES.md`), plus the minimal nav extension to add Loops as a third `AutomationKind` segment.

### Backend routes/shapes verified by reading the code

All from `cmd/gizzi-code/src/runtime/server/routes/automations.ts:228-344`:

- `GET /v1/automations/loops` (lines 228-242): `db.select().from(LoopTable).all()` via bare `c.json(rows)` — same no-envelope shape as Routines.
- `POST /v1/automations/loops` (lines 243-272): validated against `LoopCreateSchema` (lines 33-39) — `{ id?, agent_id?, command, exit_condition?, max_iterations?: number (default 10) }`. **Confirmed the task spec's called-out difference from Routines**: the inserted row (lines 257-267) sets `state: "running"` (not `"defined"`), and the handler calls `LoopEngine.startLoop(loop.id).catch(console.error)` immediately, before responding — a loop starts executing the instant it's created, with no separate "create then run" step. Row keys are snake_case (`agent_id`, `exit_condition`, `max_iterations`, `iteration_log`, `time_created`, `time_updated`), same convention as Routine.
- `PUT /v1/automations/loops/:id` (lines 273-301): returns `{ success: true }` only — confirmed, not called by this build (see deviations, same call as Phase 2's Routines PUT).
- `DELETE /v1/automations/loops/:id` (lines 302-319): returns `{ success: true }`.
- `POST /v1/automations/loops/:id/run` (lines 320-344): sets `state: "running"` and calls `LoopEngine.startLoop(id)` again — the route's own `describeRoute` summary literally says "Restart an automation loop", confirming the task spec's framing. Responds `{ success: true, state: "running" }` immediately, fire-and-forget like Routines' run.

No `GET /loops/:id` and no runs/history endpoint — confirmed by reading the whole `automations.ts` loops block; same as Routines, the detail view works from the already-fetched list item and `LoopStore.refresh()` (whole-list) is the only way to pick up server-driven changes.

### `iteration_log` shape (read from `loop-engine.ts` in full, not guessed)

`LoopEngine.startLoop` (lines 14-106) drives the loop: while `iteration < max_iterations` and the DB row's `state` is still `"running"` (checked fresh from the DB each pass, so an external `PUT` changing `state` mid-loop stops it, lines 25-32), it runs `command` via `spawn(..., shell: true)` (line 113), and after each run pushes one `LoopLogEntry` (interface at lines 6-11):

```ts
interface LoopLogEntry {
  iteration: number
  output: string    // stdout + stderr concatenated (line 41)
  exitCode: number
  timestamp: string // new Date().toISOString() (line 43)
}
```

This is a plain TS interface serialized as a JSON array in the `iteration_log` column — **not** a drizzle-mapped row like the loop's own top-level fields, so its own keys are already camelCase on the wire (`exitCode`, not `exit_code`). Modeled as `LoopIteration` (`Loop.swift`) with no `CodingKeys` needed, since `iteration`/`output`/`exitCode`/`timestamp` all match the wire exactly — a genuine, confirmed asymmetry from the loop row's own snake_case fields, called out in the model file's doc comment.

Exit logic (lines 59-70, read to model `state` correctly): if `exit_condition` is set, the loop stops successfully (`state: "succeeded"`) when it equals literal `"exit_code_zero"` and the command exited 0, OR when the command's combined output contains the `exit_condition` string; if `exit_condition` is unset, the default is exit-code-zero. If `max_iterations` is exhausted without success, `state` becomes `"max_iterations"` (lines 90-105) — modeled as a distinct, non-"succeeded" terminal state (styled as a warning, not a hard failure, since it just means the cap was hit) rather than folded into a generic "failed".

### iOS files

- `Core/API/Models/Loop.swift` — `LoopIteration` (`Decodable`, camelCase wire, no `CodingKeys`), `Loop` (`Decodable` only, matching `Routine`'s decode-only convention) with explicit `CodingKeys` for the row's snake_case wire, `CreateLoopRequest` (`Encodable`, also needs explicit `CodingKeys` since `exit_condition`/`max_iterations` genuinely differ from their Swift camelCase names — unlike `CreateRoutineRequest`, whose field names happened to need no mapping).
- `Core/API/LoopsClient.swift` — mirrors `RoutinesClient` exactly: direct `AppConfig.gizziCodeBaseURL`, route-line-number doc comments, `Self.escape(id)` helper, only the endpoints actually used (`listLoops`, `createLoop`, `runLoop`, `deleteLoop`).
- `Core/LoopStore.swift` — `@MainActor final class LoopStore: ObservableObject`, `@Published private(set)` state, same fetch-if-needed/refresh/mutate-then-refresh pattern as `RoutineStore`.
- `Features/Automation/Views/LoopsListView.swift`, `LoopDetailView.swift`, `CreateLoopSheet.swift` — mirror the Routines views' structure with the spec'd differences: create form requires only `command` (monospaced, reusing the visual pattern from Routine's step-command fields), `max_iterations` is a `Stepper` (1...100, default 10) not free text, no "Run Now" at creation time since the loop is already running once created, and the detail view's Restart action is disabled while `state == "running"` (label swaps to "Running…") since the task spec calls out that Run there is really a restart that's only meaningful once stopped/finished. The iteration log replaces Routine's step list, with each entry expandable to show its full `output` (mirroring `AutomationTaskDetailView`'s cron run-row expand/collapse pattern from Phase 1).

### Nav wiring

Extended, not duplicated, per the task spec:

- `AppModeStore.automationKind`'s type, `AutomationKind` (`Core/AppMode.swift`), gained a third case `.loops = "Loops"`.
- `ChatView.swift`'s `.automation` case switch gained a `.loops` branch rendering `LoopsListView`.
- Verified — by reading the actual code, not assuming — that both existing pickers in `AutomationTasksListView.swift` and `RoutinesListView.swift` already iterate `ForEach(AutomationKind.allCases, id: \.self)` generically rather than hardcoding two `Text` options, so the segmented control picked up the third "Loops" segment automatically with zero picker-code changes in either file. `LoopsListView.swift`'s own picker was written identically for symmetry. Only their doc comments were touched, to stop saying "Cron/Routines" now that there are three.
