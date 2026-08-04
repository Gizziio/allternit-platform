<<<<<<< HEAD
# Steering spec — Automation Tasks (iOS) Phase 3: Loops

Source: `docs/AUTOMATION_TASKS_PHASE_3_TASK.md`. Backend already exists
(`v1/automations` loops routes, `cmd/gizzi-code/src/runtime/server/routes/
automations.ts:228-344`) — this phase is iOS-only, mirroring the Phase 2
routines implementation (`docs/AUTOMATION_TASKS_PHASE_2_NOTES.md`), which
itself mirrored Phase 1 cron.

## Requirements

- [x] R1: WHEN the Automation Tasks tab loads Loops, THE SYSTEM SHALL fetch
  `GET v1/automations/loops` via a dedicated `LoopsClient` connecting
  directly to `AppConfig.gizziCodeBaseURL` (same host as
  `CronClient`/`RoutinesClient`/`PtyClient`/`PermissionClient`, NOT the
  `allternit-api` relay), and decode the bare array response with correct
  wire shape: snake_case row keys (`agent_id`, `exit_condition`,
  `max_iterations`, `iteration_log`, `time_created`, `time_updated`) but
  **camelCase** `iteration_log` element keys (`LoopLogEntry` is a plain TS
  interface, not a drizzle column — confirmed by reading `loop-engine.ts`).
- [x] R2: WHEN a user creates a loop, THE SYSTEM SHALL POST
  `v1/automations/loops` with `{ command, exit_condition?, max_iterations }`
  where only `command` is required, `max_iterations` is entered via a
  numeric stepper (not free text), and the resulting loop is already
  `state: "running"` on return — unlike Routines, there is no separate
  "create then run" step.
- [x] R3: WHEN a user taps Restart on a loop, THE SYSTEM SHALL POST
  `v1/automations/loops/:id/run` (no body, fire-and-forget server-side,
  restarts a stopped/finished loop) and refresh the list afterward. The
  action SHALL be disabled while the loop's own `state == "running"`, since
  restart is only meaningful once stopped — even though the endpoint itself
  doesn't reject a redundant call.
- [x] R4: WHEN a user taps Delete on a loop, THE SYSTEM SHALL DELETE
  `v1/automations/loops/:id` and remove it from local state.
- [x] R5: THE SYSTEM SHALL NOT implement pause/resume (no such endpoint) and
  SHALL NOT implement a run-history view/endpoint call (no
  `/loops/:id/runs`, no `GET /loops/:id`) — the detail view shows current
  `state` and the row's own `iteration_log` (refetched via whole-list
  refresh) instead, each entry expandable to show full command output.
- [x] R6: THE SYSTEM SHALL extend the existing `AutomationKind` enum
  (`.cron`, `.routines`) with a third `.loops` case and wire it into
  `ChatView.swift`'s switch, re-using the already-generic
  `ForEach(AutomationKind.allCases...)` pickers in `AutomationTasksListView`/
  `RoutinesListView` rather than duplicating picker logic in a new place.
- [x] R7: THE SYSTEM SHALL NOT touch Goals (Phase 4, out of scope) or make
  any backend changes.
- [x] R8: Swift files SHALL mirror the Phase 2 routine files' structure,
  naming, property-wrapper choice, and error/loading-state conventions
  exactly, as sibling files: `LoopsClient.swift`, `Models/Loop.swift`,
  `LoopStore.swift`, `LoopsListView.swift`, `LoopDetailView.swift`,
  `CreateLoopSheet.swift`.

## Acceptance (Gherkin)

- Scenario: Loops list loads with correct wire shape
  Given `GET v1/automations/loops` returns a bare array of loop rows with
  snake_case row keys and a camelCase `iteration_log` array
  When `LoopsListView` appears
  Then `LoopStore.fetchLoopsIfNeeded()` decodes it into `[Loop]` without a
  decoding error.
- Scenario: Create requires only a command, loop starts immediately
  Given a user fills in only "Command" and leaves exit condition blank,
  max_iterations at its default of 10
  When they tap Create
  Then `POST v1/automations/loops` is sent with `{command, max_iterations:
  10}` (`exit_condition` omitted, not null-encoded), and the created row's
  `state` is `"running"` with no separate Run action needed.
- Scenario: Restart is disabled while running
  Given a loop in state "running"
  When `LoopDetailView` renders its action row
  Then the Restart button is disabled and labeled "Running…".
- Scenario: Restart re-enables once stopped, refreshes instead of trusting response
  Given a loop in state "succeeded" or "max_iterations"
  When Restart is tapped
  Then `POST .../run` is called, its response is discarded, and
  `LoopStore.refresh()` re-fetches the list so `state` becomes "running".
- Scenario: Third segment reachable from both existing views
  Given a user is on `AutomationTasksListView` (Cron) or `RoutinesListView`
  When they tap the "Loops" segment
  Then `ChatView`'s `.automation` case renders `LoopsListView`, and its own
  segmented control can flip to either of the other two.

## Verification status

- `swift -frontend -parse` clean on all 6 new files + 4 modified files
  (`AppMode.swift`, `ChatView.swift`, `AutomationTasksListView.swift`,
  `RoutinesListView.swift` — the latter two touched only for doc comments).
- No Xcode build / simulator run (excluded by task constraints).
- No live gizzi-code server QA — response shapes verified by reading
  `automations.ts:228-344` and the full `loop-engine.ts` source directly.
- Deliverable notes at `docs/AUTOMATION_TASKS_PHASE_3_NOTES.md`, including
  the exact `iteration_log`/`LoopLogEntry` shape and how it was modeled.
=======
# Steering spec — MLX provider for the memory agent's generation tasks

## Requirements

- [ ] R1: WHEN `MEMORY_LLM_BASE_URL` is set (e.g. http://localhost:8080/v1),
  THE SYSTEM SHALL route generation tasks (ingest, consolidate, query,
  extract) to the OpenAI-compatible endpoint using the preset model names
  mapped via `MEMORY_LLM_MODEL` (single model for all generation tasks), and
  embeddings SHALL remain on Ollama.
- [ ] R2: WHEN `MEMORY_LLM_BASE_URL` is unset, THE SYSTEM SHALL behave exactly
  as today (Ollama generate path, MODEL_PRESETS names).
- [ ] R3: WHEN the MLX endpoint is unreachable mid-request, THE SYSTEM SHALL
  fail the request with a clear error (no silent fallback to a different
  model — wrong-model answers are worse than failed ones).
- [ ] R4: WHEN local-model.ts is changed, THE SYSTEM SHALL keep its existing
  callers working (http-server.ts, orchestrator.ts) with no signature
  changes beyond optional config, and unit-test the provider switch.

## Acceptance (Gherkin)

- Scenario: MLX path used when configured
  Given MEMORY_LLM_BASE_URL set to a stub OpenAI server
  When a generate task runs
  Then the request hits /v1/chat/completions with the MEMORY_LLM_MODEL name,
  and embeddings still hit Ollama.
- Scenario: default unchanged
  Given the env unset
  When a generate task runs
  Then Ollama is used with the preset model name.
>>>>>>> origin/ao/mlxmem
