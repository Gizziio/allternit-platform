# iOS Cowork Workspace — Gap Map

**Item:** #4 Cowork workspace (CoworkRoot) (PARTIAL → iOS)  
**Branch:** `feat/ios-cowork-workspace`  
**Source of truth:** web `surfaces/ai.allternit.com/src/views/cowork/CoworkRoot.tsx`

## Current iOS state

- Cowork exists only as a composer-level mode toggle inside `ChatView.swift` (`ChatCoworkToggle`, `CoworkTopDeck`).
- There is NO dedicated Cowork workspace screen. Toggling Cowork only changes the session origin surface and shows the project/permissions top deck.
- PR #13 added a flat `CoworkTasksListView` reachable as a sheet from the composer plus-menu. It is not integrated with a session workspace.
- Existing Cowork API client: `CoworkTasksClient.swift`, `CoworkTasksStore.swift`, models `CoworkProject.swift`, `CoworkTask.swift`.

## Web reference architecture (CoworkRoot.tsx)

1. **Launchpad** (`CoworkLaunchpad`) — shown when no active Cowork session.
   - Start a new session via `POST /api/v1/cowork/sessions`.
   - Resume a previous session from `GET /api/v1/cowork/sessions?limit=30`.
2. **Project view** (`CoworkProjectView`) — shown when `activeProjectId` is set.
3. **Active session workspace** — chat-first layout:
   - Center: chat transcript (`CoworkChat`/`CoworkTranscript`) + composer.
   - Right rail overlay (`CoworkRightRail`): task progress, working files, artifacts, context.
   - Sub-modes: agents (workflow pipeline), web (browser), routines, loops, sync.

## iOS phase plan

### Phase 1 — Workspace shell + launchpad + session entry (this task)
- Add `CoworkWorkspaceView` as a full-screen sheet reachable from the existing Cowork toggle in `ChatView`.
- Add `CoworkSessionStore` to list/create/select Cowork sessions (`/api/v1/cowork/sessions`).
- Build a launchpad: "New Cowork Session" button + recent sessions list.
- When a session is selected/created, push to a `CoworkSessionWorkspaceView` shell.
- The shell reuses the existing chat feed/composer by embedding the current `ChatView` with a pre-set `currentSessionId` and `originSurface = "cowork"`.
- Add a minimal right-rail button that opens a slide-over `CoworkProgressPanel` with:
  - Parsed tasks from streamed messages (reuse `parseTodosFromMessages` logic from web).
  - Working files parsed from tool-use messages.
  - A link to the existing `CoworkTasksListView` sheet.

### Phase 2 (later) — Rich right rail + project view
- Port the full `CoworkRightRail` content (progress checklist, working folder, context, artifacts).
- Integrate `CoworkProjectView` when a project is selected.
- Add sub-mode tabs (agents/web/routines/loops/sync).

### Phase 3 (later) — Inline work blocks + approval gates
- Port `CoworkStreamBlock`, `PermissionModal`, `QuestionModal`.

## Key files to read/write

- Read:
  - `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift`
  - `surfaces/allternit-mobile/ios/Features/Chat/ViewModels/ChatViewModel.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkTasksListView.swift`
  - `surfaces/allternit-mobile/ios/Core/API/CoworkTasksClient.swift`
  - `surfaces/allternit-mobile/ios/Core/CoworkTasksStore.swift`
  - `surfaces/ai.allternit.com/src/views/cowork/CoworkRoot.tsx`
  - `surfaces/ai.allternit.com/src/views/cowork/CoworkRightRail.tsx`
  - `surfaces/ai.allternit.com/src/lib/cowork/useCoworkSession.ts`
- Write:
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkWorkspaceView.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkSessionWorkspaceView.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkLaunchpadView.swift`
  - `surfaces/allternit-mobile/ios/Features/Cowork/Views/CoworkProgressPanel.swift`
  - `surfaces/allternit-mobile/ios/Core/CoworkSessionStore.swift`
  - `surfaces/allternit-mobile/ios/Core/API/CoworkSessionsClient.swift`
  - `surfaces/allternit-mobile/ios/Core/API/Models/CoworkSession.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Chat/Views/ChatView.swift` to add the workspace entry button.

## Constraints

- Match existing iOS conventions: `Color("BgPrimary")`, `Color("TextPrimary")`, `.font(.system(.title3, design: .serif))`, SF Symbols.
- Use the existing `APIClient` (`APIClient.shared`) and async/await patterns.
- Reuse existing `ChatViewModel` and `MessageRow` for chat rendering — do NOT rewrite a chat transcript.
- No builds/typechecks/dev servers in the executor; syntax-parse verification only.
- No git operations by the executor.
