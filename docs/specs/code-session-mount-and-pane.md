# Code session mount and pane

## Goal

A Code Mode session must mount successfully from the Code surface composer, and once mounted the user can open a focused right-side workspace pane (Terminal, Diff, ACI, Files, Artifacts) from a minimal floating launcher.

## Session mount flow

1. The user sends a message from `CodeCanvas.tsx` (`handleSend`).
2. `createCodeSession()` in `CodeSessionStore.ts` creates a session via `createModeSessionStore` with `originSurface: 'code'`.
3. If the backend `/api/v1/agent-sessions` call fails (e.g. `401`), the store retains an optimistic local session with `executionPersistence: "local"` and `agentModeId: "code"`.
4. The Code agent-mode executor (`agent-mode-executor.ts`) routes `agentModeId: "code"` through the built-in `code` plugin and maps artifacts to `kind: "jsx"`. Previously the `code` mapping was missing, which caused "Plugin not found: undefined".
5. `CodeThreadView` derives `hasSession` from `useCodeSessionStore.activeSessionId`. When a session exists, the floating launcher appears and the conversation stage is rendered.

## Right-side workspace pane

When `hasSession` is true, `CodeThreadView` renders a floating launcher in the top-right corner. Selecting an icon opens a right-side pane.

### Launcher (`CodeSessionLauncher.tsx`)

The launcher is a compact row of icon buttons:

- **Terminal** — opens the workspace terminal pane.
- **Diff** — opens the working-tree diff pane.
- **ACI** — opens the computer-use viewport pane.
- **Ellipsis** — opens a menu of session actions:
  - Artifacts library → opens the Artifact Center inside the right pane.
  - Files → opens the file explorer inside the right pane.
  - Open in → submenu with New window, VS Code, Terminal.
  - Rename → prompts for a new session name and updates the session.
  - Transcript view → opens a dedicated transcript pane inside the right side panel.
  - Fork → creates a new session cloned from the current one.
  - Archive → marks the session inactive and archives it in metadata.
  - Delete → deletes the session after confirmation.

The launcher only renders when the pane is collapsed (`isPreviewCollapsed === true`). Opening any pane collapses the launcher and expands the right pane.

### Pane content (`CodeSessionSidePane.tsx`)

The pane header shows the active tool icon + label and a close button. Content is determined by `activeTab`:

| Tab | Content | Backend integration |
|-----|---------|---------------------|
| `terminal` | `UnifiedTerminal` | Creates a shell session via `POST /terminal/create`, streams output through `EventSource /terminal/:id/stream`, and sends stdin via `POST /terminal/:id/input` |
| `diff` | `CodeDiffPanel` | POSTs to `/git/diff` with the workspace root path |
| `files` | `ExplorerView` | Calls `filesApi.listDirectory({ path: workingDir, recursive: true })` |
| `artifacts` | `ArtifactCenter` | Reads from the execution event stream / receipt store |
| `aci` | `CodeAciPane` | Renders `ACIComputerUseView` and health-checks the computer-use gateway |
| `transcript` | `CodeTranscriptPane` | Reads messages from `useCodeSessionStore` for the active session |

### ACI pane (`CodeAciPane.tsx`)

Header controls:

- Annotate — toggles annotate cursor; clicking the viewport adds numbered annotation markers.
- Select element — toggles crosshair cursor; clicking the viewport draws a selection box.
- Actions menu:
  - Open file — opens a selected local file (object URL).
  - Save screenshot — captures and downloads the current ACI screenshot.
  - Manage allowed sites — edits the runtime allowed-sites list.
  - Open links in browser — toggle persisted in `browserAgent.store.ts`.
  - Disable auto verify — toggle persisted in `browserAgent.store.ts`.
  - Persist sessions — dropdown (Don't keep / Shared / Separate) persisted in `browserAgent.store.ts`.
- Expand — toggles fullscreen overlay for the ACI viewport.
- Close — collapses the pane.

ACI settings in `browserAgent.store.ts` are included in every new computer-use run payload.

## Detached session window

"Open in → New window" invokes `window.allternit.shell.openSession` via the Electron preload bridge. There is no browser-tab fallback: outside the desktop shell the action is a no-op with a console warning.

The new window loads `/platform` with query params:

- `detachedSurface=code`
- `detachedSessionId=<sessionId>`
- `detachedWorkspaceId=<workspaceId>`

`ShellApp.tsx` reads these params, sets Code mode active, restores the session/workspace, hides the mode switcher, and passes `sessionOnlyId` to `ShellRail.tsx`. The rail then renders only the current session entry instead of the full mode rail.

## File map

| Concern | File |
|--------|------|
| Session creation & local fallback | `surfaces/ai.allternit.com/src/views/code/CodeSessionStore.ts` |
| Send flow / worktree toggle | `surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx` |
| Code plugin routing | `surfaces/ai.allternit.com/src/lib/agents/agent-mode-executor.ts` |
| Thread layout / launcher / pane chrome | `surfaces/ai.allternit.com/src/views/code/CodeThreadView.tsx` |
| Floating launcher | `surfaces/ai.allternit.com/src/views/code/CodeSessionLauncher.tsx` |
| Pane content shell | `surfaces/ai.allternit.com/src/views/code/CodeSessionSidePane.tsx` |
| ACI viewport + controls | `surfaces/ai.allternit.com/src/views/code/CodeAciPane.tsx` |
| Session transcript view | `surfaces/ai.allternit.com/src/views/code/CodeTranscriptPane.tsx` |
| Terminal frontend wiring | `surfaces/ai.allternit.com/src/components/workspace/UnifiedTerminal.tsx` |
| Terminal backend wiring | `cmd/allternit-api/src/terminal_routes.rs` |
| Diff backend wiring | `surfaces/ai.allternit.com/src/views/code/CodeDiffPanel.tsx` |
| Files backend wiring | `surfaces/ai.allternit.com/src/views/code/ExplorerView.tsx` |
| Artifacts UI | `surfaces/ai.allternit.com/src/views/code/ArtifactCenter.tsx` |
| ACI runtime state | `surfaces/ai.allternit.com/src/capsules/browser/browserAgent.store.ts` |
| Detached window IPC | `surfaces/allternit-desktop/src/main/unified-main.ts`, `surfaces/allternit-desktop/src/preload/index.ts` |
| Detached window shell | `surfaces/ai.allternit.com/src/shell/ShellApp.tsx`, `surfaces/ai.allternit.com/src/shell/ShellRail.tsx` |

## UX principles

1. **One way in**: panel navigation lives only in the floating launcher; the expanded pane header shows only the current tool and a close button.
2. **Right-side placement**: the expanded pane opens on the right, not the left.
3. **Icon consistency**: launcher icons use the same bold/duotone weight treatment as the shell rail mode switcher.
4. **Real actions**: every launcher menu item is wired to an existing store, API, or IPC call; no purely decorative menu items remain.

## Testing

- `agent-mode-executor.test.ts` verifies Code Mode routes through the `code` plugin and emits `jsx` artifacts.
- `CodeSessionLauncher.test.tsx` verifies the three pane icons fire, the session-actions menu renders, and Transcript view opens the transcript pane.
- `CodeSessionSidePane.test.tsx` verifies the selected pane renders and the close button fires.
- `CodeTranscriptPane.test.tsx` verifies messages render and the transcript can be copied.
- `CodeCanvas.test.tsx` verifies the session-mounted conversation appears and the old duplicate toolbar is absent.

## Known follow-ups

- The dead quick-action state in `CodeCanvas.tsx` is unrelated to the launcher and can be removed separately.
- The detached window relies on Electron IPC; it is only available inside the Allternit Desktop shell.
- The terminal backend requires `tmux` on the host. Future work can add a native PTY crate (`portable-pty` / `tokio-pty`) to remove that dependency and provide lower-latency streaming.
