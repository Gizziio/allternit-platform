# Task: iOS Cowork Workspace — Phase 1

Read `docs/COWORK_WORKSPACE_MAP.md` for full context. Execute ONLY phase 1 below. Do not start phase 2.

## Scope

Build the minimum viable iOS Cowork workspace:
1. A `CoworkWorkspaceView` launchpad reachable from the existing Cowork toggle.
2. A `CoworkSessionStore` + API client for `/api/v1/cowork/sessions`.
3. A `CoworkSessionWorkspaceView` shell that embeds the existing chat surface for a selected Cowork session.
4. A minimal slide-over `CoworkProgressPanel` showing parsed tasks/files from messages.

## Exact deliverables

### New files

1. `surfaces/allternit-mobile/ios/Core/API/Models/CoworkSession.swift`
   - Model `CoworkSession`: `id`, `userId`, `projectId`, `title`, `status`, `mode`, `checkpoint`, `metadata`, `startedAt`, `completedAt`, `createdAt`, `updatedAt`.
   - `CoworkSessionListResponse` with `sessions: [CoworkSession]`.
   - `CreateCoworkSessionBody` with `name` and `sessionMode` (default `"regular"`).
   - `CreateCoworkSessionResponse` with nested `session.id`.
   - Use explicit `CodingKeys` for snake_case JSON.

2. `surfaces/allternit-mobile/ios/Core/API/CoworkSessionsClient.swift`
   - `CoworkSessionsClient` with async methods:
     - `listSessions(limit: Int = 30) -> [CoworkSession]`
     - `createSession(name: String, sessionMode: String = "regular") -> String` (returns new session id)
     - `deleteSession(id: String)`
     - `patchSession(id: String, checkpoint: String?, status: String?)`
   - Use `APIClient.shared` `get(path:)`, `post(path:body:)`, etc., matching `CoworkTasksClient.swift` style.

3. `surfaces/allternit-mobile/ios/Core/CoworkSessionStore.swift`
   - `@MainActor final class CoworkSessionStore: ObservableObject`
   - `@Published var sessions: [CoworkSession] = []`
   - `@Published var isLoading: Bool = false`
   - `@Published var errorMessage: String? = nil`
   - `func fetchSessionsIfNeeded()` and `func refreshSessions()`
   - `func createSession(name: String) async throws -> String`
   - `func deleteSession(id: String)`
   - `static let shared`

4. `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkWorkspaceView.swift`
   - `struct CoworkWorkspaceView: View` with `@Environment(\.dismiss)`.
   - Body is a `NavigationStack` containing the launchpad:
     - Header row: "Cowork" title + dismiss button.
     - "New Session" primary button that calls `store.createSession(name:)`, then navigates to `CoworkSessionWorkspaceView(sessionId:)`.
     - "Recent Sessions" section listing fetched sessions (title or "Session <date>" fallback).
     - Swipe-to-delete a session.
   - `.task { store.fetchSessionsIfNeeded() }`

5. `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkSessionWorkspaceView.swift`
   - `struct CoworkSessionWorkspaceView: View` taking `sessionId: String`.
   - Full-screen layout:
     - Top toolbar: back/close button, session title, right-rail toggle button.
     - Main area: embed `ChatView(selectedSessionId: .constant(sessionId), isSidebarOpen: .constant(false))` so the existing chat feed + composer fill the workspace.
     - Slide-over overlay on trailing side: `CoworkProgressPanel(messages: viewModel.messages)`.
   - Use `@StateObject private var chatViewModel = ChatViewModel()` and set `chatViewModel.loadSession(sessionId)` + `chatViewModel.sessionContext.originSurface = "cowork"` in `.task`.
   - The panel visibility is toggled by the toolbar button.

6. `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkProgressPanel.swift`
   - `struct CoworkProgressPanel: View` taking `messages: [MessageRecord]`.
   - Parse tasks from messages matching web `CoworkRightRail.parseTodosFromMessages`:
     - Look for `AgentChatEvent`/`ReplyEvent` parts with `type == "task"` and `type == "plan"` steps.
     - For now, a simpler regex/text parse is acceptable: scan message content for `[ ]`, `[x]`, `TODO:` markers.
   - Parse working files from tool-use messages: regex for file paths ending in common extensions.
   - Show two sections: "Tasks" and "Files".
   - Include a button "Open Cowork Tasks" that presents `CoworkTasksListView()` as a sheet.
   - Width: 320 pts, background `Color("BgPanel")`, slides in from trailing edge.

### Modified files

7. `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift`
   - Near `ChatCoworkToggle` (line ~1148) add a small "Workspace" button when `mode == .cowork` and no active session.
   - The button opens `CoworkWorkspaceView()` as a sheet.
   - Keep the existing toggle behavior unchanged.

### Not in scope

- Do NOT port `CoworkLaunchpad.tsx`, `CoworkProjectView.tsx`, `CoworkRightRail.tsx` fully.
- Do NOT add sub-modes (agents, web, routines, loops, sync).
- Do NOT modify the backend.
- Do NOT add approval/question modals.
- Do NOT run `swift build` or `xcodebuild` (sandbox lacks toolchain); do syntax-parse checks only.

## Verification

When finished, run a cheap syntax gate for every changed Swift file:
```bash
for f in <changed files>; do
  echo "$f"
  # If swift-format or swiftc is available, a parse-only check is acceptable.
  # Otherwise note that syntax was reviewed manually.
done
```

## Sentinel

Write `docs/COWORK_WORKSPACE_PHASE_1_NOTES.md` with YAML frontmatter:
```yaml
status: done
files_changed:
  - <list every new/modified file>
deviations: []
remaining:
  - Phase 2: rich right rail, project view, sub-mode tabs
```
Then write a short prose summary of what was built and any blockers.
