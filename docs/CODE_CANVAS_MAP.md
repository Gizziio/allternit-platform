# Code Canvas — Gap Map

**Item:** #25 Code Canvas (live preview split view) (PARTIAL → iOS)  
**Branch:** `feat/ios-code-canvas`  
**Reference:** web `surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx`,
`CodeCanvasView.tsx`, `CodeModeStore.ts`

## Current state

- Web has a mature Code Canvas: infinite pan/zoom workspace, draggable/resizeable
  tiles (session, preview, diff, terminal, notes, knowledge, knowledge-graph,
  executor), minimap, HUD, context menu, h5i side panels, workspace bar, and
  bottom status bar.
- The web canvas state lives entirely in `CodeModeStore` (Zustand + browser
  localStorage). There is **no backend API** for code workspaces or canvas
  persistence today.
- iOS has no canvas concept at all. The Code tab is a flat session list → chat
  thread flow.

## Phase 1 plan

Ship an iOS "Code Workspace" shell that gives users a canvas-style entry point
without re-implementing the full infinite canvas in one pass.

1. Add a workspace model (`CodeWorkspace`) and local in-memory store
   (`CodeCanvasStore`) on iOS.
2. Build `CodeCanvasView.swift`: a workspace shell with a workspace bar and a
   grid of code-session tiles backed by existing `AgentChatClient.listSessions()`.
3. Tapping a tile pushes the existing `CodeThreadChatView` (reuse, don't
   rebuild).
4. Add a "Canvas" toolbar button to `CodeModeView.swift` to open the workspace.
5. Persist nothing to disk in phase 1 (mirrors the web's local-only state, and
   avoids inventing a backend spec).

## Files

- Read:
  - `surfaces/ai.allternit.com/src/views/code/CodeCanvas.tsx`
  - `surfaces/ai.allternit.com/src/views/code/CodeCanvasView.tsx`
  - `surfaces/ai.allternit.com/src/views/code/CodeModeStore.ts`
  - `surfaces/allternit-mobile/ios/Features/Code/CodeModeView.swift`
- Write:
  - `docs/CODE_CANVAS_MAP.md`
  - `surfaces/allternit-mobile/ios/Core/API/Models/CodeWorkspace.swift`
  - `surfaces/allternit-mobile/ios/Core/CodeCanvasStore.swift`
  - `surfaces/allternit-mobile/ios/Features/Code/CodeCanvasView.swift`
  - Update `surfaces/allternit-mobile/ios/Features/Code/CodeModeView.swift`

## Constraints

- Match existing iOS conventions.
- No backend schema changes (there is no backend for this feature today).
- No builds/typechecks; syntax review only.
- Phase 1 is a read-only workspace grid with navigation to existing chat
  threads. Full infinite canvas, drag/resize tiles, tile types beyond session,
  minimap, HUD, and h5i panels are deferred.
