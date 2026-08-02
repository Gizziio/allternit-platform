# Automation Tasks — Phase 1 Task (iOS, Cron Jobs only)

Read `docs/AUTOMATION_TASKS_MAP.md` first — full grounded analysis, exact file/line citations on both backend and web. Apply it, don't re-derive it.

## Scope

Build an iOS "Automation Tasks" area covering **cron jobs only** (Routines/Loops/Goals are out of scope — later phases). A user should be able to: see their scheduled/recurring jobs, view a job's detail (status, schedule, run history), pause/resume/delete a job, manually trigger a run, and create a new simple prompt-based ("agent" type) scheduled job.

## Backend contract (already live, no backend changes)

Base: `AppConfig.gizziCodeBaseURL`, path prefix `v1/cron` (same server as `PtyClient`/`PermissionClient` already use — **not** `APIClient.shared`/`ProjectsClient`'s relay pattern, which hits a different backend, `allternit-api`).

- `GET v1/cron/jobs` → `CronJob[]`
- `GET v1/cron/jobs/:id` → `CronJob`
- `POST v1/cron/jobs` body `CreateJobInput` → `CronJob` (201)
- `PUT v1/cron/jobs/:id` body `UpdateJobInput` → `CronJob`
- `DELETE v1/cron/jobs/:id`
- `POST v1/cron/jobs/:id/pause`
- `POST v1/cron/jobs/:id/resume`
- `POST v1/cron/jobs/:id/run` — manual trigger
- `GET v1/cron/jobs/:id/runs` → `CronRun[]`

`CronJob` is a discriminated union by `type` (`cmd/gizzi-code/src/runtime/automation/cron/types.ts:63-155`) — for Phase 1 you only need to fully model `type: "agent"` (`config: { prompt, agentId?, model?, context?, maxTokens?, temperature? }`); for other types (`shell`/`http`/`cowork`/`function`), decode the common `BaseJob` fields and treat `config` as opaque/unused (do not crash on unknown config shapes — the list/detail views must render any job type, just without a specialized config display beyond "type: shell" etc.).

`BaseJob` common fields to model: `id: String, name: String, description: String?, type: String, status: String ("active"|"paused"|"disabled"|"error"), schedule: CronSchedule (see below), createdAt: String, updatedAt: String, lastRunAt: String?, nextRunAt: String?, runCount: Int, failCount: Int, tags: [String]`.

`Schedule` is itself a union: `CronSchedule { type: "cron", expression: String, timezone: String? }` or `IntervalSchedule { type: "interval", seconds: Int, startAt: String? }` (`types.ts:41-52`). Decode both; render `expression` when `type == "cron"`, or "every N seconds" when `type == "interval"`.

`CronRun` fields to model: `id: String, jobId: String, status: String (pending|running|success|failed|cancelled|timeout), scheduledAt: String, startedAt: String?, finishedAt: String?, durationMs: Int?, output: String?, error: String?, triggeredBy: String`.

Dates are ISO-8601 strings — decode as `String` and format for display with a `DateFormatter`/`ISO8601DateFormatter` at the view layer (do not fight `Decodable`'s default date strategy; keep the model's date fields `String` and parse only where displayed, matching how other clients in this codebase handle timestamps — check `CoworkProject`/`AgentSession` for the existing convention and match it).

## Files to add

1. **`Core/API/CronClient.swift`** — REST client, exact shape of `PermissionClient.swift` (`init(baseURL: URL = AppConfig.gizziCodeBaseURL)`, wraps `APIClient(baseURL:tokenProvider:)`, same `Self.escape(id)` path-escaping helper, doc comments citing exact backend file:line per method like `PtyClient`/`PermissionClient` already do). Methods: `listJobs()`, `getJob(id:)`, `createAgentJob(name:prompt:schedule:) -> CronJob` (POST with `type: "agent"`, `config: { prompt }`), `pause(id:)`, `resume(id:)`, `runNow(id:)`, `deleteJob(id:)`, `listRuns(jobId:)`.
2. **`Core/CronJobStore.swift`** — `@MainActor final class CronJobStore: ObservableObject` singleton (`static let shared`), exact shape of `Core/ProjectStore.swift` (read it first): `@Published var jobs: [CronJob]`, a `refresh()`/`load()` async method, and mutating helpers (`pause(id:)` etc.) that call `CronClient` then update local state optimistically + refresh.
3. **`Features/Automation/Views/AutomationTasksListView.swift`** — list screen, structural pattern from `ProjectsListView.swift`: search/filter (by `status`, at minimum an Active/Paused/All segmented control — schedule-type filtering not required), row shows name, schedule description, status badge, next run time. Tap pushes detail. A toolbar "+" opens a creation sheet.
4. **`Features/Automation/Views/AutomationTaskDetailView.swift`** — structural pattern from `ProjectDetailView.swift`: header (name, description, status, schedule, type), action row (Pause/Resume — whichever applies to current status —, Run Now, Delete with confirmation), and a run-history list below (from `listRuns`) showing status, started/finished time, duration, and output/error inline (truncated, expandable) for each run.
5. **`Features/Automation/Views/CreateAutomationTaskSheet.swift`** — minimal creation form: name (required), prompt (required, multiline), schedule — a single text field accepting a cron expression (e.g. `0 9 * * *`) with helper text showing an example, submitted as `CreateJobInput.schedule` as a plain string (the backend's `parseScheduleToType` in `cron/service.ts:220-222` already accepts a string, including natural language per the file's own doc comment — no client-side cron parsing/validation needed, let the server reject invalid input and surface its error message).

## Where this surfaces in the app

Find where `ProjectsListView`/similar top-level feature views are already reachable from the app's navigation (sidebar/tab rail — check `Features/` root-level shell/navigation files for the pattern) and add "Automation Tasks" alongside them the same way. Do not invent a new top-level navigation paradigm — match whatever mechanism Projects/Cowork/Code already use to be reachable.

## Explicitly out of scope for this phase

- Routines, Loops, Goals (`/v1/automations` routes) — separate future phases.
- Creating `shell`/`http`/`cowork`/`function` type jobs — view/manage only for non-agent types.
- No backend changes.
- Do NOT start any other item from `docs/SURFACE_AUDIT_PROGRESS.md`.

## Constraints

- Match repo idiom exactly: SwiftUI, named color assets, `ObservableObject` store singleton pattern (mirror `ProjectStore`), doc-comments in the `PtyClient`/`PermissionClient` style citing exact backend file:line.
- No git operations.
- No Xcode build/run required — this sandboxed environment can't build (`Mesh.xcframework` missing, confirmed pre-existing/unrelated in prior phases). Just ensure syntactic completeness and internal consistency (no references to non-existent types/functions).
- Additive only — don't modify `ProjectsClient.swift`, `ProjectStore.swift`, `PermissionClient.swift`, or any backend file. The one exception is whatever single navigation/shell file needs a new entry point added (identify it, touch only what's needed to add the entry).

## Deliverable

`docs/AUTOMATION_TASKS_PHASE_1_NOTES.md`, YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`) then prose: describe the actual list/detail/create UI, which navigation file you hooked into and how, and any assumption made where this spec was ambiguous. That file existing = done.
