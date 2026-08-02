---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/Models/CronJob.swift (new)
  - surfaces/allternit-mobile/ios/Core/API/CronClient.swift (new)
  - surfaces/allternit-mobile/ios/Core/CronJobStore.swift (new)
  - surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTasksListView.swift (new)
  - surfaces/allternit-mobile/ios/Features/Automation/Views/AutomationTaskDetailView.swift (new)
  - surfaces/allternit-mobile/ios/Features/Automation/Views/CreateAutomationTaskSheet.swift (new)
  - surfaces/allternit-mobile/ios/Core/AppMode.swift (edit — new `ModeBarItem.automation` case + doc comments)
  - surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift (edit — new `.automation` case in `MainWorkspaceView`'s content switch + doc comment)
  - surfaces/allternit-mobile/ios/Features/History/Views/HistorySidebarView.swift (edit — comment only, tab-list description)
deviations:
  - "PermissionClient.swift does not exist in this checkout (grep confirms no such file anywhere under surfaces/allternit-mobile/ios). Used PtyClient.swift as the sole shape reference instead — same init signature, same APIClient wrapping, same Self.escape(id) helper, same doc-comment citation style."
  - "Added a models file (Core/API/Models/CronJob.swift) beyond the 5 files the spec listed, matching the existing split between *Client.swift (REST calls) and Models/*.swift (wire types) used by ProjectsClient.swift/CoworkProject.swift and AgentSession.swift."
  - "CronClient's method list omits updateJob/PUT — not requested in the spec's method list (only listJobs/getJob/createAgentJob/pause/resume/runNow/deleteJob/listRuns), and Phase 1 has no edit-job UI to call it from."
  - "runNow() discards the CronRun the server returns from POST .../run (routes/cron.ts:264-268) rather than decoding it — the detail view re-fetches run history right after triggering, which is simpler and keeps the store's mutation methods uniformly Void-returning."
  - "The 'single navigation/shell file' turned out to be two coupled files: Core/AppMode.swift owns the ModeBarItem enum (tab identity + the mode-store's exhaustive switch) and Features/Chat/Views/ChatView.swift owns MainWorkspaceView's per-tab content switch. Both are switch statements the compiler requires to stay exhaustive, so adding one destination necessarily touches both; HistorySidebarView.swift needed no code change (it iterates ModeBarItem.allCases generically) — only its explanatory comment was updated for consistency with the other two."
remaining:
  - "No backend changes were made or needed (out of scope, backend already live)."
  - "Editing an existing job (PUT .../jobs/:id) is unimplemented — spec's file list didn't call for it and Phase 1 has no edit UI; only create/pause/resume/run/delete are wired."
  - "Confirmed rather than assumed the pre-existing build blocker: xcodebuild build against the iOS Simulator destination was run for verification and failed immediately (\"There is no XCFramework found at .../Frameworks/Mesh.xcframework\") during dependency/build-graph resolution, before any Swift source — old or new — reaches the compiler. This matches the spec's claim exactly; it does not additionally validate this change's Swift correctness beyond what swiftc -parse (below) already covers."
---

# Automation Tasks — Phase 1 (Cron Jobs) — Implementation Notes

## What was built

A new **Automation Tasks** tab, covering cron jobs only (`v1/cron/*` on
gizzi-code's server), following the backend contract and file plan in
`docs/AUTOMATION_TASKS_PHASE_1_TASK.md` / `docs/AUTOMATION_TASKS_MAP.md`
exactly.

### Networking (`CronClient.swift`, `Core/API/Models/CronJob.swift`)

`CronClient` is shaped like `PtyClient` (the closest still-existing
reference — see Deviations): a `static let shared`, an `init(baseURL: URL =
AppConfig.gizziCodeBaseURL)` wrapping a private `APIClient` with
`tokenProvider: { try await AuthManager.shared.getToken() }`, and a private
`Self.escape(id)` percent-encoding helper. Every method's doc comment cites
the exact route file:line in `cmd/gizzi-code/src/runtime/server/routes/
cron.ts`. Methods: `listJobs()`, `getJob(id:)`, `createAgentJob(name:prompt:
schedule:)`, `pause(id:)`, `resume(id:)`, `runNow(id:)`, `deleteJob(id:)`,
`listRuns(jobId:)`.

`CronJob` models `BaseJob`'s common fields plus an optional `agentConfig:
CronAgentConfig?` populated only when `type == "agent"` — a custom
`init(from:)` decodes every `BaseJob` field unconditionally and only reaches
into `config` when the discriminator matches, so shell/http/cowork/function
jobs decode cleanly with `agentConfig == nil` instead of crashing or being
dropped from the list. `CronJobSchedule` mirrors the `CronSchedule |
IntervalSchedule` union the same way (switch on `type`, unknown shapes fall
back to a `.unknown` case rendered as "Unknown schedule" rather than failing
the whole job's decode). `CronRun` models only the fields the spec asked for;
Swift's `Decodable` silently ignores the extra wire fields (`attempt`,
`exitCode`, `metadata`, …) since they're not declared as properties.

Per-file convention check: this backend (gizzi-code, a TS/Hono server) emits
plain camelCase JSON with no snake_case conversion, unlike the Rust-backed
`allternit-api` models (`CoworkProject`, `AgentSession`), so `CronJob`/
`CronRun` need no `CodingKeys` remapping — confirmed by reading `cron/
types.ts` directly rather than assuming the CoworkProject convention applied.

Dates stay `String` on every model; both list and detail views parse them
with `Date(_:strategy: Date.ISO8601FormatStyle(includingFractionalSeconds:
true))` (falling back to the non-fractional-seconds form), then render with
`RelativeDateTimeFormatter` — copied verbatim from `CodeModeView`'s private
`parseTimestamp`/"Last seen" convention (the closest existing timestamp
formatter in the codebase, confirmed via grep for `RelativeDateTimeFormatter`
and `DateFormatter()`).

### Store (`CronJobStore.swift`)

`@MainActor final class CronJobStore: ObservableObject`, `static let
shared`, `@Published private(set) var jobs: [CronJob]`, matching
`ProjectStore`'s shape: `fetchJobsIfNeeded(force:)` dedupes concurrent
callers via an in-flight `Task`, plus an unconditional `refresh()` for
pull-to-refresh and post-mutation resync. `createAgentJob` inserts optimistically
then calls `refresh()` so server-computed fields (`nextRunAt`, the parsed
`schedule`) land; `pause`/`resume`/`runNow`/`deleteJob` call the client then
resync (delete removes locally without a full refetch, matching
`ProjectStore.deleteProject`). `listRuns(jobId:)` is a pass-through — run
history isn't cached on the store since only one detail view reads it at a
time.

### List (`AutomationTasksListView.swift`)

Hosted as a full standalone tab (like `AgentHubView`, not sheet-hosted like
`ProjectsListView`), so its header is the sidebar-toggle + title + "+"
chrome rather than `ProjectsListView`'s dismiss-button chrome. Segmented
control: **All / Active / Paused** (spec asked for "at minimum" that pair
plus All; ordered All-first to match `ProjectsListView`'s own tab-ordering
convention). Each row shows name, schedule description
(`job.schedule.displayText` — the raw cron expression, "every Ns" for
interval schedules, or the timezone-suffixed cron form), a colored status
badge (`active`→green, `paused`→amber, `error`→red, anything else→secondary
text color), and a relative "Next run" line when `nextRunAt` is present.
Search filters by name client-side, same pattern as `ProjectsListView`.
Tapping a row pushes `AutomationTaskDetailView`; the toolbar "+" opens
`CreateAutomationTaskSheet`.

### Detail (`AutomationTaskDetailView.swift`)

Header shows description, status (colored), type, schedule, last/next run
(relative), run/fail counts, and — only for agent jobs — the prompt in a
bordered card. Action row shows **Pause** or **Resume** (whichever applies
to `liveJob.status`) plus **Run Now**; **Delete** lives in the toolbar with
a confirmation alert (`ProjectDetailView`'s rename/delete menu pattern,
simplified to a single destructive toolbar button since there's no rename
affordance here). Run history lists every `CronRun`: a colored status dot,
"Started/Scheduled <relative time>", duration (ms below 1s, else `%.1fs`),
and — tap to expand — the run's `error` (preferred) or `output` in a
monospaced inline block. `liveJob` re-derives from `CronJobStore.shared.job
(withId:)` so pause/resume/delete reflect immediately, exactly like
`ProjectDetailView.liveProject`.

### Create (`CreateAutomationTaskSheet.swift`)

Three required fields — Name, Prompt (multiline), Schedule (single-line,
helper text with a cron example) — in `NewProjectSheet`'s rounded
field-bubble style, Create disabled until all three are non-empty. The
schedule string is passed through verbatim to `CronJobStore.createAgentJob`
→ `CronClient.createAgentJob`, which POSTs `{ type: "agent", schedule:
<string>, config: { prompt } }`; no client-side cron parsing/validation, per
spec — the server's `parseScheduleToType` (`cron/service.ts:220-222`)
handles both cron expressions and natural language, and any rejection
surfaces as the server's own error message via `actionError` on the list
view.

## Navigation

`ModeBarItem` (`Core/AppMode.swift`) gained a seventh case, `.automation`
("Automation Tasks", SF Symbol `clock.arrow.circlepath`), between `.agents`
and `.code` — it needed no persistence-key or `AppMode` mapping since,
like Projects/Artifacts/Agents, it's a pure iOS-side tab layered over the
existing modes (`selectBarItem`'s exhaustive switch just falls into the
existing `break` case alongside `.projects`/`.artifacts`/`.agents`).
`MainWorkspaceView` in `Features/Chat/Views/ChatView.swift` gained the
matching `case .automation: AutomationTasksListView(isSidebarOpen:
$isSidebarOpen)` arm in its content switch. `HistorySidebarView` needed no
code change — it renders `ModeBarItem.allCases` generically — only its
explanatory comment was touched. This is the same mechanism Projects/
Artifacts/Agents already use to be reachable; no new navigation paradigm was
introduced.

## Assumptions made where the spec was ambiguous

- **`PermissionClient.swift` doesn't exist.** The spec's file-shape
  reference ("exact shape of `PermissionClient.swift`") pointed at a file
  this checkout doesn't have (confirmed by exhaustive grep). `PtyClient.swift`
  — named as the doc-comment-style reference for the same file — covers the
  same ground (gizzi-code direct client, `AppConfig.gizziCodeBaseURL` init,
  `APIClient` wrapping, `Self.escape` helper) and was used as the sole
  template.
- **Segmented-control order** (All/Active/Paused vs. Active/Paused/All):
  the spec listed the filter values without prescribing order; picked
  All-first for consistency with `ProjectsListView`'s own tab ordering.
- **Where a models file lives**: added `Core/API/Models/CronJob.swift`
  rather than inlining the structs into `CronClient.swift` (`PtyClient.swift`
  inlines its one small `PtyInfo` struct, but the cron domain's
  discriminated unions are large enough that following the `CoworkProject.swift`
  / `AgentSession.swift` split felt truer to repo idiom).
- **`runNow`'s return value**: the route actually returns the newly created
  `CronRun` (`routes/cron.ts:264-268`), not the job — `CronClient.runNow`
  discards it (`Void`) and the detail view re-fetches run history right
  after, which keeps `CronJobStore`'s mutation methods uniformly
  fire-and-refresh.

## Verification

`swiftc -parse` ran clean on all 6 new files plus the 3 edited files
(catches syntax errors only, not type errors — no cross-file type-checking
tool was available given the build blocker below). Every cross-file
reference (`Theme.*`, `Color("...")` asset names, `AppConfig.gizziCodeBaseURL`,
`AuthManager.shared.getToken()`, `APIClient` method signatures, `ModeBarItem`
exhaustiveness) was verified by reading the referenced declaration directly
rather than assumed.

An actual `xcodebuild build -scheme Allternit -destination 'generic/platform=
iOS Simulator'` was also run, to check the spec's "sandbox can't build"
claim rather than take it on faith. It failed immediately — `error: There is
no XCFramework found at '.../Frameworks/Mesh.xcframework'` — during
dependency/build-graph resolution, before Swift compilation of any file
(old or new) begins. The claim holds; no additional type-checking signal
was available from this run. No golden-path UI testing was performed (no
simulator interaction attempted) — that remains open per the spec's own "no
Xcode build/run required" allowance.
