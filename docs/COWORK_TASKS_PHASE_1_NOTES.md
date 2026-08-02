---
status: done
files_changed:
  - surfaces/allternit-mobile/ios/Core/API/Models/CoworkTask.swift (new)
  - surfaces/allternit-mobile/ios/Core/API/CoworkTasksClient.swift (new)
  - surfaces/allternit-mobile/ios/Core/CoworkTasksStore.swift (new)
  - surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkTasksListView.swift (new)
  - surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkTaskDetailView.swift (new)
  - surfaces/allternit-mobile/ios/Features/Cowork/Views/CreateCoworkTaskSheet.swift (new)
  - surfaces/allternit-mobile/ios/Features/Chat/Views/ComposerPlusSheet.swift (integration edit)
deviations:
  - "createTask() has no status parameter per the task spec's exact client signature (section 1), but the map doc's scope decision says new tasks default to status "todo", not the server's own "backlog" default (TaskStatus::Backlog). Resolved by hardcoding status: \"todo\" inside CreateCoworkTaskRequest itself rather than exposing it as a client parameter — satisfies both docs without changing the specified method signature."
  - "CoworkTask/CoworkTaskStatus/CoworkAssigneeType/CoworkTaskRisk all gained Hashable (beyond the spec's literal Decodable/Sendable/Identifiable) because CoworkTaskDetailView is pushed via .navigationDestination(item:), which requires Hashable — the same requirement CoworkProject already satisfies for ProjectDetailView's identical push pattern."
remaining:
  - No screenshot/UI verification possible in this sandbox (Mesh.xcframework missing, confirmed pre-existing per the task's Constraints section) — swiftc -parse is clean on all 7 files but the feature has not been run.
  - CoworkTaskDetailView's status Menu and Delete button are the only mutation surfaces; title/description editing is not exposed in Phase 1's UI even though updateTask(title:description:) exists on the client/store for API completeness (matches the spec's explicit method signature).
---

# Cowork Tasks — Phase 1 Notes

## Wire-format casing (confirmed against `cowork_models.rs`)

- **`status` (`TaskStatus`, cowork_models.rs:726-735)**: `#[serde(rename_all = "kebab-case")]` → `"backlog"`, `"todo"`, `"in-progress"`, `"in-review"`, `"done"`. `CoworkTaskStatus` maps `.inProgress = "in-progress"` and `.inReview = "in-review"`; `.backlog`/`.todo`/`.done` need no explicit raw value since their Swift case names already lowercase-match the wire.
- **`assignee_type` (`AssigneeType`, cowork_models.rs:744-750)**: `#[serde(rename_all = "lowercase")]` → `"human"`, `"agent"`. `CoworkAssigneeType.human`/`.agent` match without remapping.
- **`risk` (`TaskRisk`, cowork_models.rs:759-766)**: `#[serde(rename_all = "lowercase")]` → `"low"`, `"medium"`, `"high"`. `CoworkTaskRisk` decoded for parity with the full wire record (`Task.risk: Option<TaskRisk>`) even though Phase 1's UI never sets or displays it — out of scope per the map doc, but a field the server can still send back on every task.

All three are Rust enum `#[serde(rename_all = ...)]` attributes on `cowork_models.rs`, confirmed by reading the source directly rather than assuming from the task doc's prose summary.

## Status-badge color mapping

`Theme` (Color+Theme.swift:71-74) only defines three status hues: `statusSuccess`, `statusWarning`, `statusInfo` — no dedicated "muted" token. Mapping landed as:

- **Backlog / Todo → `Color("TextSecondary")`** (stands in for "muted" — no muted token exists to pick from).
- **InProgress → `Theme.statusInfo`**.
- **InReview → `Theme.statusWarning`** (the task spec allowed InProgress→info/warning; InReview needed its own distinct hue from InProgress, so InProgress took `info` and InReview took `warning` — InReview is the state waiting on a human reviewer, which reads more naturally as a "needs attention" warning color than InProgress's steady-state info).
- **Done → `Theme.statusSuccess`**.

Rendered as a small capsule badge (colored text on a 15%-opacity fill of the same color) in `CoworkTasksListView.statusBadge`.

## `ComposerPlusSheet`'s visibility condition, and how the new row matches it

Read `permissionsRow` directly (ComposerPlusSheet.swift:332-352, pre-edit): it's a `Menu` bound to `agentModeStore.coworkPermission`, placed unconditionally in the sheet's `VStack` — no `if agentModeStore...` guard, no `@ViewBuilder` branch, nothing gating its visibility on cowork/agent mode. It's always shown, in every mode, exactly like `projectRow` and `toolAccessSection` above it.

Per the task spec's explicit instruction ("if `permissionsRow` has no such gating and is always visible, mirror that... rather than inventing a new visibility rule"), `coworkTasksRow` is likewise unconditional — a plain `Button` placed directly in the `VStack` right after `permissionsRow`, no gating added.

## Assumptions made where the spec was ambiguous

1. **List/detail navigation shape.** The spec offered a choice ("or an inline expand — your call"). Went with `ProjectsListView`/`ProjectDetailView`'s exact precedent: `CoworkTasksListView` wraps its content in its own `NavigationStack` (list is a sheet with a custom header + dismiss button, mirroring `ProjectsListView`'s `onOpenSidebar == nil` sheet-hosted branch) and pushes `CoworkTaskDetailView` via `.navigationDestination(item:)`.
2. **`createTask` status default.** See `deviations` above — resolved by hardcoding `"todo"` in the request body rather than adding an unspec'd parameter.
3. **`coworkTasksRow`'s trailing `value` text.** `menuRow(icon:iconColor:title:value:)` requires a trailing value string (`permissionsRow` shows the current permission, `projectRow` shows the selected project). Cowork Tasks has no analogous "current selection" to show, so `value` is passed as `""` — chevron still renders, row chrome stays identical.
4. **Detail view weight.** Spec allowed either a dedicated `CoworkTaskDetailView.swift` or folding detail into the list as a `.sheet`. Built it as a separate, lighter pushed view (title/description/status Menu/assignee/delete) rather than `ProjectDetailView`'s file/chat sections — a task has far fewer fields than a project, so a single scrollable section covers it without the extra weight.
5. **Icon choices.** `"checklist"` for the composer row and list empty-state icon, `"circle.dashed"` for the detail view's status Menu row (no precedent icon exists for either in this codebase; picked SF Symbols that read clearly at the row's 15pt icon size).
6. **Title-field autocapitalization** in `CreateCoworkTaskSheet` uses `.sentences` (task titles read like short sentences/imperatives — "Fix the login bug") rather than `NewProjectSheet`'s `.words` (project names read more like proper nouns).
