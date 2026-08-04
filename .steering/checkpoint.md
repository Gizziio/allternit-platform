# Steering checkpoint

## Goal

Automation Tasks (iOS) Phase 3: build Loops as an iOS sibling surface to the
already-shipped Phase 1 cron and Phase 2 routines implementations, backed by
the already-existing `v1/automations/loops` backend (no backend changes).
Spec: `docs/AUTOMATION_TASKS_PHASE_3_TASK.md`.

## Just did

- Read the full backend route handlers (`cmd/gizzi-code/src/runtime/server/
  routes/automations.ts:228-344`) and the entire `loop-engine.ts` to confirm
  exact wire shapes — in particular the `iteration_log` element shape
  (`LoopLogEntry`) — before writing any Swift, same discipline as Phase 2.
- Confirmed the task spec's called-out backend differences from Routines by
  reading the code directly: loops start running immediately on creation
  (`LoopEngine.startLoop` called inline in the POST handler, row's initial
  `state` is `"running"` not `"defined"`), and `iteration_log` elements are
  camelCase (`LoopLogEntry` is a plain TS interface, not a drizzle column)
  while the loop row's own top-level fields are snake_case like Routine's.
- Built the Loops equivalents of every Phase 2 routine file, as siblings:
  - `Core/API/Models/Loop.swift` — `LoopIteration` (`Decodable`, camelCase
    wire, no `CodingKeys` needed), `Loop` (`Decodable` only, matching
    `Routine`'s decode-only convention, explicit snake_case `CodingKeys`),
    `CreateLoopRequest` (`Encodable`, needs `CodingKeys` since
    `exit_condition`/`max_iterations` genuinely diverge from Swift naming,
    unlike Routine's create body).
  - `Core/API/LoopsClient.swift` — mirrors `RoutinesClient` exactly; only
    implements endpoints actually used (`listLoops`, `createLoop`,
    `runLoop`, `deleteLoop`) — no `PUT`/update, nothing in scope calls it.
  - `Core/LoopStore.swift` — same `ObservableObject`/`@Published`
    fetch-if-needed/refresh/mutate-then-refresh pattern as `RoutineStore`.
  - `Features/Automation/Views/LoopsListView.swift`, `LoopDetailView.swift`,
    `CreateLoopSheet.swift` — mirror the Routines views with the spec'd
    differences: create form's required field is `command` (monospaced),
    `max_iterations` is a `Stepper` (1...100, default 10) not free text, no
    "Run Now" at creation (loop already running), and the detail view's
    Restart action is disabled + relabeled "Running…" while `state ==
    "running"`. Iteration log replaces the step list, each entry expandable
    to show full output (mirrors Phase 1's cron run-row expand pattern).
- Wired nav: added `AutomationKind.loops` as a third case
  (`Core/AppMode.swift`) and a `.loops` branch in `ChatView.swift`'s switch.
  Verified — by reading the actual code, not assuming — that both existing
  pickers in `AutomationTasksListView.swift`/`RoutinesListView.swift` already
  iterate `ForEach(AutomationKind.allCases...)` generically, so they picked
  up the third segment with zero picker-code changes; only touched their
  doc comments (stale "Cron/Routines" -> "Cron/Routines/Loops").
- Verified: `swift -frontend -parse` clean on all 10 touched files (6 new, 4
  modified). No Xcode build/simulator run or live-server QA, per task
  constraints — response shapes verified by reading source only.
- Wrote deliverable `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md` (frontmatter +
  prose), including the exact `iteration_log`/`LoopLogEntry` shape found and
  how it was modeled.
- Rewrote `.steering/checkpoint.md`/`spec.md` for this phase proactively
  (not waiting for a steering flag this time — staleness was called out as
  a recurring gap after Phase 2).

## Files changed

- `surfaces/allternit-mobile/ios/Core/API/Models/Loop.swift` (new)
- `surfaces/allternit-mobile/ios/Core/API/LoopsClient.swift` (new)
- `surfaces/allternit-mobile/ios/Core/LoopStore.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/LoopsListView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/LoopDetailView.swift` (new)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/CreateLoopSheet.swift` (new)
- `surfaces/allternit-mobile/ios/Core/AppMode.swift`
- `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift`
- `surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift` (doc comment only)
- `surfaces/allternit-mobile/ios/Features/Automation/Views/RoutinesListView.swift` (doc comment only)
- `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md` (new, deliverable)
- `.steering/checkpoint.md`, `.steering/spec.md` (this update)

## Known follow-ups

- No Xcode build/simulator run performed (excluded by task constraints).
- No manual QA against a running gizzi-code server.
- No git operations performed (no commit/push/PR) — per task constraints,
  the orchestrator handles that after review.
- Goals (Phase 4) remains untouched, as scoped.
