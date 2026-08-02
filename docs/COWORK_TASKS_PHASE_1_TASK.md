# Cowork Tasks — Phase 1 Task (iOS)

Read `docs/COWORK_TASKS_MAP.md` first — full grounded analysis, exact backend contract, and the scope decision (flat task list, not project-nested; skip Sources/comments/queue/dependencies). Apply it, don't re-derive it.

## Scope

A task list reachable from Cowork mode: two segments (Tasks / Agent Tasks, filtered by `assignee_type`), create/view/change-status/delete.

## Files to add

1. **`Core/API/CoworkTasksClient.swift`** — REST client, exact shape of `RuntimeDevicesClient` (`Core/API/InstancesClient.swift`): `AppConfig.cloudAPIBaseURL` + `APIClient.shared.authorizedRequest(url:method:)` + `client.session.data(for:)` + `client.validate(response:data:)` + manual `JSONDecoder`/`JSONEncoder` (snake_case wire format — set `decoder.keyDecodingStrategy`/explicit `CodingKeys`, whichever matches this file's existing convention more closely; check `RuntimeDevice`'s own `CodingKeys` first). Methods:
   - `listTasks(workspaceId: String = "default") async throws -> [CoworkTask]` → `GET api/v1/tasks?workspace_id=<id>`
   - `createTask(workspaceId: String = "default", title: String, description: String?, assigneeType: String?) async throws -> CoworkTask` → `POST api/v1/tasks`
   - `updateTask(id: String, status: String? = nil, title: String? = nil, description: String? = nil) async throws -> CoworkTask` → `PUT api/v1/tasks/:id`
   - `deleteTask(id: String) async throws` → `DELETE api/v1/tasks/:id`
2. **`Core/API/Models/CoworkTask.swift`** — `CoworkTask: Decodable, Sendable, Identifiable` mirroring the `Task` struct fields listed in the map doc exactly (snake_case wire, camelCase Swift properties via `CodingKeys`). `status`/`assigneeType`/`risk` as Swift `enum: String, Codable` matching the wire's kebab-case (`"in-progress"`, `"in-review"`) / lowercase (`"human"`, `"agent"`, `"low"`, `"medium"`, `"high"`) values exactly — verify the exact wire casing against `cowork_models.rs`'s `#[serde(rename_all = ...)]` attributes before assuming, don't guess. Request body structs (`CreateTaskRequest`/`UpdateTaskRequest` Swift-side) only need the fields Phase 1's UI actually sends (see scope above) — do not model every server-side field if the UI never sets it.
3. **`Core/CoworkTasksStore.swift`** — `@MainActor final class CoworkTasksStore: ObservableObject`, `static let shared`, exact shape of `Core/CronJobStore.swift`: `@Published private(set) var tasks: [CoworkTask]`, `refresh()`, `create(...)`, `updateStatus(id:status:)`, `delete(id:)` — mutate via the client then resync, matching the existing store convention in this codebase.
4. **`Features/Cowork/Views/CoworkTasksListView.swift`** — presented as a sheet (not a pushed nav view — this app has no dedicated Cowork screen to push onto, see integration point below). Segmented control: Tasks / Agent Tasks (client-side filter on `assigneeType`). Row: title, status badge (color per status — pick from existing `Theme.status*` tokens, map Backlog/Todo→muted, InProgress→info/warning, InReview→warning, Done→success, whichever mapping already-established badge conventions in this codebase suggest), priority if non-zero. Tap opens `CoworkTaskDetailView` (or an inline expand — your call, keep it simple, this is Phase 1). Toolbar "+" opens `CreateCoworkTaskSheet`.
5. **`Features/Cowork/Views/CoworkTaskDetailView.swift`** (or fold into the list as a `.sheet` detail — pick whichever matches this codebase's usual list/detail weight for a similarly-small model; `ProjectDetailView.swift` is the heavier precedent, a lighter inline pattern is also acceptable given this model is smaller) — title, description, a status-changing control (Menu, matching `ComposerPlusSheet`'s `permissionsRow` Menu pattern), Delete with confirmation.
6. **`Features/Cowork/Views/CreateCoworkTaskSheet.swift`** — title (required), description (optional, multiline), an assignee-type segmented control (Human / Agent — defaults to whichever the current list segment is), Create disabled until title is non-empty.

## Integration point

Add a new row to `ComposerPlusSheet.swift` (`surfaces/allternit-mobile/ios/Features/Chat/Views/ComposerPlusSheet.swift`), alongside the existing `permissionsRow` (search for `private var permissionsRow` — around line 331) — same `menuRow(icon:iconColor:title:value:)` chrome, but instead of a `Menu`, a plain `Button` that sets a new `@State private var isCoworkTasksPresented = false` and presents `CoworkTasksListView` via `.sheet(isPresented:)` on the sheet's own root view. Only show this row when `agentModeStore` (or however this file already detects cowork mode — check `permissionsRow`'s own visibility condition, if any, and match it) indicates Cowork is active; if `permissionsRow` has no such gating and is always visible, mirror that (always visible) rather than inventing a new visibility rule.

## Explicitly out of scope

- Sources tab, comments, queue-claiming, dependencies, SSE live task events, deadline/risk/estimated_minutes fields.
- Any change to `ProjectsClient.swift`/`ProjectStore.swift` (a genuinely different, already-working iOS feature against a different backend — do not conflate).
- No backend changes.
- Do NOT start any other item from `docs/SURFACE_AUDIT_PROGRESS.md`.

## Constraints

- Match repo idiom exactly: SwiftUI, named color/theme tokens, the three established client/store/view patterns cited above (verify each by reading the actual reference file before writing, don't work from memory of this doc's summary).
- No git operations.
- No Xcode build/run required — this sandboxed environment can't build (`Mesh.xcframework` missing, confirmed pre-existing across every phase this session). `swiftc -parse` on every new/changed file is required and must be clean.
- Additive only, except the one integration edit to `ComposerPlusSheet.swift` described above.

## Deliverable

`docs/COWORK_TASKS_PHASE_1_NOTES.md`, YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`), then prose: the exact wire-format casing you confirmed for each enum (cite the `cowork_models.rs` line), what the status-badge color mapping ended up being and why, how `ComposerPlusSheet`'s visibility condition works and how the new row matches it, and any assumption made where this spec was ambiguous. That file existing = done.
