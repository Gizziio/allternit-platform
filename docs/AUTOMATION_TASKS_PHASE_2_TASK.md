# Automation Tasks (iOS) — Phase 2: Routines

## Context (already researched — do not re-derive)

Phase 1 (Cron jobs) shipped in PR #9, merged to main. This is Phase 2: **Routines only**. Do NOT build Loops or Goals — those are separate future phases. Keep this diff reviewable, same discipline as Phase 1.

Read `docs/AUTOMATION_TASKS_MAP.md` first for the full original research (data model, conventions, why Phase 1 was scoped to cron-only).

## Backend — no changes needed, already exists

Mounted at `v1/automations` on gizzi-code's own server (`cmd/gizzi-code/src/runtime/server/server.ts:367,455`), same base URL as cron/pty/permission (`AppConfig.gizziCodeBaseURL`) — NOT the `APIClient.shared` relay pattern `ProjectsClient` uses.

Routes (`cmd/gizzi-code/src/runtime/server/routes/automations.ts:104-225`):
- `GET /v1/automations/routines` — returns a bare array of routine rows, no envelope (`automations.ts:104-121`)
- `POST /v1/automations/routines` — body validated against `RoutineCreateSchema` (`automations.ts:15-22`): `{ id?, agent_id?, name, steps?: {command,status}[] (default []), trigger?, schedule? }`. Returns the created row, 201.
- `PUT /v1/automations/routines/:id` — body is `RoutineUpdateSchema` (`automations.ts:24-31`): all fields optional including `state`. Returns `{ success: true }` (NOT the updated row — refetch after).
- `DELETE /v1/automations/routines/:id` — returns `{ success: true }`.
- `POST /v1/automations/routines/:id/run` — no body. Returns `{ success: true, state: "running" }`. Triggers `RoutineEngine.startRoutine(id)` server-side, async/fire-and-forget.

Routine row shape (from the insert in `automations.ts:139-150`): `{ id: string, agent_id: string|null, name: string, steps: {command:string,status:string}[], trigger: string|null, schedule: string|null, state: string ("defined"|"running"|...), time_created: number (ms epoch), time_updated: number (ms epoch) }`.

There is no `GET /routines/:id` single-item endpoint or a runs/history endpoint for routines (unlike cron's `/jobs/:id` and `/jobs/:id/runs`) — the detail view works from the already-fetched list item, refetching the whole list after any mutation. Do not invent an endpoint that doesn't exist.

## iOS pattern to mirror exactly

The Phase 1 cron implementation (files below, all on iOS at `surfaces/allternit-mobile/ios/`):
- `Core/API/CronClient.swift` — the networking client. Mirror its exact style: direct `AppConfig.gizziCodeBaseURL` connection via `APIClient`, doc comments citing the exact backend route + line numbers, `Self.escape(id)` percent-encoding helper for path ids, one method per endpoint.
- `Core/API/Models/CronJob.swift` — request/response Codable models.
- `Core/CronJobStore.swift` — the `@Observable`/store layer wrapping the client (check its actual property-wrapper/observation pattern and copy it, along with its refresh-after-mutation approach given cron's `PUT` also returns bare `{success:true}`-shaped responses in some calls — check how `CronJobStore` already handles that asymmetry, since Routines' `PUT`/`run` have the exact same "returns success, not the row" shape).
- `Features/Automation/Views/AutomationTasksListView.swift` and `AutomationTaskDetailView.swift` — list → tap → detail pattern, pause/resume/run-now/delete actions, empty/loading/error states.
- `Features/Automation/Views/CreateAutomationTaskSheet.swift` — creation sheet.

Build the Routines equivalents as sibling files in the same locations:
- `Core/API/RoutinesClient.swift`
- `Core/API/Models/Routine.swift`
- `Core/RoutineStore.swift`
- `Features/Automation/Views/RoutinesListView.swift`
- `Features/Automation/Views/RoutineDetailView.swift`
- `Features/Automation/Views/CreateRoutineSheet.swift`

Routine-specific UI differences from cron (do not copy blindly):
- No schedule-required field on create — `trigger`/`schedule` are both optional (a routine can be manually run, unlike cron's schedule-mandatory model). Creation form: required `name`, optional `steps` (list of command strings — start each step with status `"pending"`), optional `trigger`, optional `schedule`.
- No run-history list (no `/runs` endpoint) — detail view shows current `state` and step list with per-step `status`, not a history of past runs.
- Actions available: Run (`POST .../run`), Delete. There is no dedicated pause/resume endpoint for routines (unlike cron) — do not add pause/resume buttons; `state` is server-driven only via `run` and updates.

## Where this plugs into navigation

Find where `AutomationTasksListView` (cron) is currently surfaced in the app's tab/navigation (likely `AppMode.swift` or a Cowork/Chat context-strip entry point per `docs/AUTOMATION_TASKS_MAP.md`'s note that this satisfies the Cowork Cron view / Intelli-Schedule / Code Automation Tasks rows too). Add Routines as an adjacent, clearly-labeled sibling entry point (e.g., a segmented control or second tab alongside the existing cron list), not a separate unrelated nav item — a user should discover both Cron and Routines from the same "Automation" surface.

## Constraints

- Swift only, this iOS app. No backend changes (none needed).
- Do not touch Loops or Goals — Phase 3/4, out of scope.
- No git operations (no commit, no push, no PR) — the orchestrator (outside your session) handles that after review.
- No builds/xcodebuild/typechecks/simulator runs — the orchestrator will validate separately if needed. If you have Xcode/swift tooling available and want to sanity-check syntax, that's fine, but don't treat a successful build as the deliverable gate.
- Match repo idiom: SwiftUI, `@Observable` (check actual macro used in `CronJobStore`), existing error-handling/loading-state conventions from the cron store — copy them, don't invent new ones.
- Do NOT edit `docs/SURFACE_AUDIT_PROGRESS.md` or `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` — those files are being actively edited by other concurrent sessions outside this worktree. Leave tracker updates to the orchestrator.

## Deliverable

When finished, write `docs/AUTOMATION_TASKS_PHASE_2_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed: [list every file you created or modified, exact repo-relative paths]
deviations: [anything you did differently from this spec, and why]
remaining: [anything left undone or uncertain]
```

Then prose notes: what you built, which exact backend routes/response shapes you verified by reading the code (not assumed), and where in the nav you wired the entry point.

That file existing = done.
