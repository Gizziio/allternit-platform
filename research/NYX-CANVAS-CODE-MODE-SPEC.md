# Nyx-Style Infinite Canvas for Allternit Code Mode

## Integration Specification

**Status:** Draft  
**Author:** Agent Research  
**Date:** 2026-04-24  
**Scope:** `surfaces/allternit-platform/src/views/code/*`  

---

## 1. Executive Summary

This specification defines how to integrate an **infinite canvas** view into Allternit's existing Code mode, inspired by Nyx's multi-session tile layout. The canvas is **not a replacement** for the current single-thread code session — it is an **alternative layout** that can display one or more sessions as movable, resizable tiles on a pan/zoom surface.

**Core principle:** The existing `CodeModeStore`, `CodeSessionStore`, and `CodeCanvas` conversation components are the canonical source of truth. The canvas is a **view layer** that renders these existing sessions in a spatial layout. No new session stores are created. No backend changes are required.

---

## 2. Deep Architecture Analysis (Existing)

### 2.1 Store Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  CodeModeStore (localStorage, client-only metadata)         │
│  ├── workspaces: CodeWorkspaceRecord[]                      │
│  │   └── workspace_id, root_path, display_name, sessions[]  │
│  ├── sessions: CodeSessionRecord[]                          │
│  │   └── session_id, workspace_id, title, mode, state...    │
│  ├── activeWorkspaceId: string                              │
│  └── activeSessionId: string                                │
│                                                             │
│  Actions: setActiveWorkspace, setActiveSession,             │
│           createWorkspace, createSession,                   │
│           renameWorkspace, deleteWorkspace                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (creates backend session via API)
┌─────────────────────────────────────────────────────────────┐
│  CodeSessionStore = createModeSessionStore({                │
│    name: 'CodeSessionStore',                                │
│    storageKey: 'allternit-code-sessions',                   │
│    originSurface: 'code'                                    │
│  })                                                         │
│                                                             │
│  ├── sessions: ModeSession[]         ← backend-backed       │
│  ├── activeSessionId: string | null                         │
│  ├── streamingBySession: Record<string, StreamingState>     │
│  ├── unreadCounts: Record<string, number>                   │
│  └── isSyncConnected, syncError                             │
│                                                             │
│  Actions: createSession, deleteSession, sendMessageStream,  │
│           abortGeneration, loadSessions, setActiveSession   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (HTTP/SSE)
┌─────────────────────────────────────────────────────────────┐
│  Backend API                                                │
│  ├── POST   /api/v1/agent-sessions        (create session)  │
│  ├── GET    /api/v1/agent-sessions/:id/messages             │
│  ├── POST   /api/agent-chat               (stream SSE)      │
│  ├── POST   /api/v1/agent-sessions/:id/abort                │
│  └── GET    /api/v1/agent-sessions/sync   (SSE events)      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Hierarchy (Current)

```
ShellApp
└── viewType === 'code'
    └── CodeRoot
        ├── ChatIdProvider (workspaceId)
        ├── DataStreamProvider
        ├── MessageTreeProvider
        └── CodeCanvas
            ├── LaunchpadStage      (no messages yet)
            │   └── ChatComposer
            └── ConversationStage   (has messages)
                ├── Conversation / ConversationContent
                │   └── StreamingChatComposer (per message)
                └── Bottom Input Dock
                    └── ChatComposer
```

### 2.3 Key Constraints Discovered

1. **ModeSessionStore creates REAL backend sessions** — every `createSession()` hits `POST /api/v1/agent-sessions`. There is no purely client-side session.
2. **Session IDs are backend-assigned** (`ses_*`) — optimistic IDs (`temp-*`) are replaced after API response.
3. **Message streaming is session-bound** — `sendMessageStream(sessionId, options)` streams to one session at a time.
4. **CodeCanvas is SINGLE-session focused** — it reads `activeSessionId` and renders one conversation thread.
5. **CodeRoot has a fixed right preview pane** — `CodePreviewPane` is hardcoded as a sibling of `CodeCanvas`.
6. **`react-resizable-panels` is already in the dependency tree** — used by `shell/panels/Panel.tsx`.
7. **No existing pan/zoom/drag canvas infrastructure** — must be built.
8. **Desktop uses a single mainWindow** — no multi-window session spawning today.

---

## 3. Design Principles

1. **Single Source of Truth** — `CodeModeStore` + `CodeSessionStore` remain the ONLY session stores. The canvas adds **layout metadata**, not session data.
2. **Backward Compatibility** — The existing single-thread `CodeCanvas` must work exactly as it does today. Users who never toggle the canvas see zero change.
3. **Canvas as a Container** — A single session tile in the canvas renders the **same `ConversationStage` component** used in single-thread mode. No forked conversation UI.
4. **No Competing State** — Canvas viewport position, zoom, and tile layouts are stored as **metadata on the workspace**, not in a new store.
5. **No Hotkeys** — All canvas interactions are mouse/touch driven or exposed through explicit UI controls (toolbar buttons, context menus, toggles).
6. **Progressive Enhancement** — Phase 1 delivers a working 2-tile canvas. Later phases add more tile types and advanced features.

---

## 4. Data Model

### 4.1 Extended `CodeWorkspaceRecord`

```typescript
// ADD to CodeModeStore.ts — no new store

export type CodeLayoutMode = 'thread' | 'canvas';

export interface CodeCanvasTile {
  /** Unique within the workspace */
  tileId: string;
  /** What this tile displays */
  type: 'session' | 'preview' | 'diff' | 'terminal' | 'notes';
  /** Link to a CodeSessionRecord.session_id (for type='session') */
  sessionId?: string;
  /** Spatial position in canvas coordinates */
  x: number;
  y: number;
  /** Size in pixels at zoom=1 */
  width: number;
  height: number;
  /** Z-order */
  zIndex: number;
  /** Optional user-given label */
  label?: string;
}

export interface CodeCanvasViewport {
  /** Canvas pan offset */
  x: number;
  y: number;
  /** Zoom level (0.25 = 25%, 1 = 100%, 3 = 300%) */
  zoom: number;
}

export interface CodeWorkspaceRecord {
  // ... existing fields ...
  sessions: string[];
  
  // NEW FIELDS (all optional for migration):
  /** Current layout mode for this workspace */
  layoutMode?: CodeLayoutMode;
  /** Canvas tile configuration */
  canvasTiles?: CodeCanvasTile[];
  /** Canvas camera position */
  canvasViewport?: CodeCanvasViewport;
  /** Focus mode: which tile is fullscreened (null = none) */
  canvasFocusTileId?: string | null;
}
```

### 4.2 Migration Strategy

Existing workspaces have no `layoutMode` → default to `'thread'`. The UI treats `undefined` as `'thread'`.

```typescript
// In CodeModeStore selectors
function getWorkspaceLayoutMode(workspace: CodeWorkspaceRecord): CodeLayoutMode {
  return workspace.layoutMode ?? 'thread';
}
```

### 4.3 Store Actions (Additions to CodeModeStore)

```typescript
interface CodeModeState {
  // ... existing ...
  
  // Canvas layout actions
  setWorkspaceLayoutMode: (workspaceId: string, mode: CodeLayoutMode) => void;
  addCanvasTile: (workspaceId: string, tile: Omit<CodeCanvasTile, 'tileId'>) => string;
  removeCanvasTile: (workspaceId: string, tileId: string) => void;
  updateCanvasTile: (workspaceId: string, tileId: string, updates: Partial<CodeCanvasTile>) => void;
  setCanvasViewport: (workspaceId: string, viewport: CodeCanvasViewport) => void;
  setCanvasFocusTile: (workspaceId: string, tileId: string | null) => void;
  /** Auto-arrange tiles in a grid */
  autoArrangeCanvasTiles: (workspaceId: string) => void;
}
```

**Why add to CodeModeStore?**
- CodeModeStore already owns workspace metadata
- It is persisted to localStorage (canvas layouts survive reload)
- It is NOT backend-synced (canvas layout is client-local, like window positions)
- No new store = no competing state

---

## 5. Component Architecture

### 5.1 New Component Hierarchy

```
ShellApp
└── viewType === 'code'
    └── CodeRoot                          (UNCHANGED — entry point)
        └── CodeSurfaceRouter             (NEW — thin wrapper)
            ├── layoutMode === 'thread'
            │   └── CodeThreadView        (NEW — extracted from current CodeRoot)
            │       ├── ChatIdProvider
            │       ├── DataStreamProvider
            │       ├── MessageTreeProvider
            │       └── CodeCanvas        (UNCHANGED — existing component)
            └── layoutMode === 'canvas'
                └── CodeCanvasView        (NEW — infinite canvas)
                    ├── CanvasToolbar     (NEW — zoom, pan, spawn controls)
                    ├── InfiniteCanvas    (NEW — pan/zoom container)
                    │   └── CanvasTile    (NEW — resizable, draggable wrapper)
                    │       └── TileContent
                    │           ├── type === 'session'
                    │           │   └── CodeCanvasTileSession   (NEW — wraps ConversationStage)
                    │           ├── type === 'preview'
                    │           │   └── CodePreviewPane         (EXISTING)
                    │           └── type === 'diff'
                    │               └── ChangesetReview         (EXISTING)
                    └── CanvasHUD         (NEW — live agent count, status)
```

### 5.2 `CodeSurfaceRouter`

A thin router that reads `activeWorkspace.layoutMode` and renders either `CodeThreadView` or `CodeCanvasView`.

```typescript
// surfaces/allternit-platform/src/views/code/CodeSurfaceRouter.tsx

export function CodeSurfaceRouter() {
  const activeWorkspace = useActiveWorkspace();
  const layoutMode = getWorkspaceLayoutMode(activeWorkspace);
  
  return layoutMode === 'canvas' 
    ? <CodeCanvasView workspace={activeWorkspace} />
    : <CodeThreadView workspace={activeWorkspace} />;
}
```

### 5.3 `CodeThreadView`

This is the **current CodeRoot behavior**, extracted into its own component so CodeRoot can host the router.

**Refactor plan:**
1. Rename current `CodeRoot` internal logic to `CodeThreadView`
2. Make `CodeRoot` render `<CodeSurfaceRouter />`
3. `CodeThreadView` receives the workspace and renders exactly what `CodeRoot` renders today

**No behavior change.** Existing tests for CodeRoot/CodeCanvas continue to pass.

### 5.4 `CodeCanvasView`

The new infinite canvas surface.

```typescript
interface CodeCanvasViewProps {
  workspace: CodeWorkspaceRecord;
}

export function CodeCanvasView({ workspace }: CodeCanvasViewProps) {
  // Subscribe to workspace canvas state
  const tiles = workspace.canvasTiles ?? [];
  const viewport = workspace.canvasViewport ?? { x: 0, y: 0, zoom: 1 };
  const focusTileId = workspace.canvasFocusTileId ?? null;
  
  // Focus mode: render only the focused tile
  if (focusTileId) {
    const focusedTile = tiles.find(t => t.tileId === focusTileId);
    if (focusedTile) return <CodeFocusView tile={focusedTile} workspace={workspace} />;
  }
  
  return (
    <div className="code-canvas-view" style={{ position: 'relative', overflow: 'hidden', height: '100%' }}>
      <CanvasToolbar workspaceId={workspace.workspace_id} />
      <CanvasHUD tiles={tiles} />
      <InfiniteCanvas 
        viewport={viewport}
        onViewportChange={(v) => setCanvasViewport(workspace.workspace_id, v)}
      >
        {tiles.map(tile => (
          <CanvasTile 
            key={tile.tileId}
            tile={tile}
            onMove={(pos) => updateCanvasTile(workspace.workspace_id, tile.tileId, pos)}
            onResize={(size) => updateCanvasTile(workspace.workspace_id, tile.tileId, size)}
            onFocus={() => setCanvasFocusTile(workspace.workspace_id, tile.tileId)}
          >
            <TileContent tile={tile} />
          </CanvasTile>
        ))}
      </InfiniteCanvas>
    </div>
  );
}
```

### 5.5 `InfiniteCanvas` (Pan/Zoom Engine)

**Technology choice:** Custom implementation using CSS transforms (not a library). Reason: the project already has custom drag implementations (BrowserPaneWrapper, CodeRoot resize handle). Adding a canvas library adds dependency weight for a solvable problem.

```typescript
interface InfiniteCanvasProps {
  viewport: CodeCanvasViewport;
  onViewportChange: (viewport: CodeCanvasViewport) => void;
  children: React.ReactNode;
}

export function InfiniteCanvas({ viewport, onViewportChange, children }: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const viewportStart = useRef({ x: 0, y: 0 });
  
  // Pan: drag on empty background
  // Zoom: scroll wheel (with ctrl/meta) OR pinch gesture
  // All implemented via pointer events for consistency
  
  return (
    <div 
      ref={containerRef}
      className="infinite-canvas"
      style={{ 
        position: 'absolute', 
        inset: 0, 
        overflow: 'hidden',
        cursor: isPanning.current ? 'grabbing' : 'grab'
      }}
    >
      {/* Grid background — 64px major + 22px minor dots */}
      <CanvasGrid viewport={viewport} />
      
      {/* Transform layer */}
      <div 
        className="canvas-transform-layer"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 0, height: 0,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Grid specification:**
- Major grid: 64px lines, `rgba(255,255,255,0.04)` — matches Nyx scanline aesthetic
- Minor grid: 22px dots, `rgba(255,255,255,0.03)` — matches Nyx fine grid
- Rendered as CSS `background-image` on the container, offset by viewport position for infinite illusion

**Zoom constraints:**
- Min: 0.25x (25%)
- Max: 3.0x (300%)
- Step: 0.1x per scroll tick
- Center point: mouse cursor position (not screen center)

### 5.6 `CanvasTile` (Draggable + Resizable Wrapper)

```typescript
interface CanvasTileProps {
  tile: CodeCanvasTile;
  onMove: (updates: { x: number; y: number }) => void;
  onResize: (updates: { width: number; height: number }) => void;
  onFocus: () => void;
  onClose?: () => void;
  children: React.ReactNode;
}
```

**Drag behavior:**
- Grab the tile header (not the content area, to avoid conflicting with text selection inside sessions)
- Use pointer events for drag (consistent with existing CodeRoot resize handle)
- Snap to 8px grid on release (configurable)

**Resize behavior:**
- 8px resize handles on corners and edges
- Min size: 320x240px
- Max size: 1200x900px
- Use pointer events

**Z-index management:**
- Clicking a tile brings it to front (increments global z-index counter)
- Stored in `CodeCanvasTile.zIndex`

### 5.7 `CodeCanvasTileSession` (Session Tile Content)

This is the **critical bridge** between existing single-thread UI and canvas UI.

```typescript
interface CodeCanvasTileSessionProps {
  sessionId: string;
  workspaceId: string;
}

export function CodeCanvasTileSession({ sessionId, workspaceId }: CodeCanvasTileSessionProps) {
  // Use EXACTLY the same hooks as CodeCanvas
  const session = useCodeSessionStore(s => s.sessions.find(ses => ses.id === sessionId));
  const messages = session?.messages ?? [];
  const isStreaming = useCodeSessionStore(s => s.streamingBySession[sessionId]?.isStreaming ?? false);
  
  // Render a CONDENSED version of ConversationStage
  // - No launchpad (canvas tiles always show conversation or empty state)
  // - Compact header showing session title + status
  // - Full ChatComposer at bottom
  // - Messages in scrollable area
  
  return (
    <div className="tile-session" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TileSessionHeader 
        title={session?.name ?? 'Untitled'}
        status={session?.metadata.sessionMode === 'agent' ? 'agent' : 'chat'}
        isStreaming={isStreaming}
      />
      <div className="tile-session-messages" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {messages.map((msg, idx) => (
          <StreamingChatComposer 
            key={msg.id}
            message={mapNativeMessagesToStreamMessages([msg])[0]}
            isLoading={isStreaming && idx === messages.length - 1}
            isLast={idx === messages.length - 1}
          />
        ))}
      </div>
      <div className="tile-session-composer" style={{ padding: 8, borderTop: '1px solid var(--border-subtle)' }}>
        <CompactChatComposer 
          onSend={(text) => sendCodeMessageStream(sessionId, { text })}
          isLoading={isStreaming}
        />
      </div>
    </div>
  );
}
```

**Key decisions:**
- Reuses `StreamingChatComposer` from existing chat system — no forked message rendering
- Uses `sendCodeMessageStream` from `CodeSessionStore` — identical backend path
- Compact composer instead of full `ChatComposer` to save vertical space in a tile
- Tile has its own scroll container — canvas does not scroll, tiles scroll internally

### 5.8 `CodeFocusView`

When a tile is "focused" (maximized), it replaces the entire canvas view:

```typescript
export function CodeFocusView({ tile, workspace }: CodeFocusViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Focus header with back button */}
      <FocusHeader 
        title={tile.label || 'Focused Session'}
        onExit={() => setCanvasFocusTile(workspace.workspace_id, null)}
      />
      {/* Full-width tile content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <TileContent tile={tile} />
      </div>
    </div>
  );
}
```

**Entry/exit:**
- Enter: Double-click a tile, or click the "expand" button on tile header
- Exit: Click the "back to canvas" button, or press Escape (this is a standard web pattern, not a custom hotkey)

---

## 6. UI/UX Design

### 6.1 Layout Mode Toggle

Located in the **Code surface header** (near workspace name), NOT in the rail.

```
[ Workspace: my-project ]  [ Thread ] [ Canvas ▼ ]  [ Model: Claude Code ]
                            ────────   ──────────
                            selected   dropdown
```

- **Thread** — current single-thread view (default)
- **Canvas** — infinite canvas view
- Toggle is **per-workspace persisted** (in `CodeWorkspaceRecord.layoutMode`)
- When switching Thread → Canvas: the current active session becomes the first tile, centered in viewport
- When switching Canvas → Thread: the currently focused/active tile's session becomes the `activeSessionId`

### 6.2 Canvas Toolbar

Floating toolbar at top-center of canvas (similar to Figma/Excalidraw):

```
┌─────────────────────────────────────────────────────┐
│  [-]  100%  [+]  │  [Arrange]  │  [+ Session] [+ Preview] [+ Diff]  │  [Grid]  │
└─────────────────────────────────────────────────────┘
```

**Elements:**
- **Zoom out / Zoom in / Zoom %** — click to zoom, click percentage to reset to 100%
- **Arrange** — auto-arrange tiles in a grid
- **+ Session** — spawn a new session tile (creates new session via `CodeSessionStore.createSession`)
- **+ Preview** — spawn a preview pane tile (reuses `CodePreviewPane`)
- **+ Diff** — spawn a diff review tile (reuses `ChangesetReview`)
- **Grid** — toggle grid visibility

**No hotkeys.** All actions are clickable.

### 6.3 Tile Header

Every tile has a header bar:

```
┌────────────────────────────────────────┬────┬────┬────┐
│  ● Agent Session    [claude-code]      │ ⧉  │ □  │ ✕  │
└────────────────────────────────────────┴────┴────┴────┘
```

- **Left dot** — color-coded status: gray (idle), blue (streaming), green (completed), red (error)
- **Title** — session name or tile label
- **Model badge** — small tag showing which model (for session tiles)
- **Expand** — enters focus mode
- **Maximize** — fits tile to available canvas space (one-time, not persistent)
- **Close** — removes tile from canvas (does NOT delete session)

### 6.4 Canvas HUD

Top-left overlay (subtle, glass-morphism):

```
┌────────────────────────┐
│  ● LIVE · 3 SESSIONS   │
│  2 idle · 1 working    │
└────────────────────────┘
```

- Shows live count of sessions and their aggregate status
- Uses existing design tokens (`tokens.glass.thin`)
- Disappears after 3 seconds of inactivity (hover to reveal)

### 6.5 Context Menu (Right-click on empty canvas)

```
Spawn Tile
├── New Session
├── Existing Session → [session-1]
│                    → [session-2]
├── Preview
└── Diff

View
├── Reset Zoom
├── Fit All Tiles
└── Toggle Grid
```

---

## 7. Session Orchestration in Canvas

### 7.1 Creating a New Session in Canvas

When user clicks "+ Session" in toolbar:

1. Call `CodeSessionStore.createSession({ name: 'New Session', workspaceId: ws.workspace_id })`
2. Wait for backend session ID
3. Call `CodeModeStore.addCanvasTile(workspaceId, { type: 'session', sessionId: newSessionId, x: centerX, y: centerY, width: 480, height: 360 })`
4. New tile appears centered in current viewport

### 7.2 Adding an Existing Session to Canvas

From context menu or drag-from-sidebar:

1. User selects an existing session from the workspace
2. `addCanvasTile` is called with the existing `sessionId`
3. Multiple tiles can reference the same `sessionId` (view-only duplicates are allowed)

### 7.3 Message Streaming

Each tile that renders a session calls `sendMessageStream` independently:

```typescript
// In CompactChatComposer inside a tile
const handleSend = async (text: string) => {
  await sendCodeMessageStream(sessionId, { text });
};
```

The backend (`/api/chat`) handles concurrent streams to different sessions natively. No special coordination needed.

### 7.4 Session Status Polling

For the HUD status dot, we already have:
- `streamingBySession[sessionId].isStreaming` — real-time from CodeSessionStore
- For idle/running differentiation: if `isStreaming` is false and messages.length > 0, status = idle

No new polling needed. We reuse the existing SSE sync channel (`connectSessionSync`).

---

## 8. Persistence

### 8.1 What Gets Persisted

| Data | Store | Scope | Backend? |
|------|-------|-------|----------|
| Workspace list | CodeModeStore | localStorage | No |
| Session metadata | CodeModeStore | localStorage | No |
| Canvas tiles | CodeModeStore | localStorage | No |
| Canvas viewport | CodeModeStore | localStorage | No |
| Session messages | CodeSessionStore | localStorage (optimistic) + Backend | Yes |
| Session streaming state | CodeSessionStore | Memory only | No |

### 8.2 Cross-Device Behavior

Canvas layout is **local-only** (like window positions). If a user opens the same workspace on another device:
- Sessions load from backend (existing behavior)
- Canvas layout resets to default (single tile with first session)
- This is acceptable — spatial layouts are personal and device-specific

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Canvas view exists, one session tile works, can toggle between Thread and Canvas.

**Files to create:**
1. `src/views/code/CodeSurfaceRouter.tsx` — layout mode router
2. `src/views/code/CodeThreadView.tsx` — extracted single-thread view
3. `src/views/code/CodeCanvasView.tsx` — canvas container
4. `src/components/canvas/InfiniteCanvas.tsx` — pan/zoom engine
5. `src/components/canvas/CanvasTile.tsx` — draggable/resizable tile wrapper
6. `src/components/canvas/CanvasGrid.tsx` — background grid
7. `src/components/canvas/CanvasToolbar.tsx` — top toolbar
8. `src/components/canvas/CanvasHUD.tsx` — status overlay
9. `src/components/canvas/CodeCanvasTileSession.tsx` — session inside a tile
10. `src/components/canvas/CompactChatComposer.tsx` — smaller composer for tiles

**Files to modify:**
1. `src/views/code/CodeModeStore.ts` — add layoutMode, canvasTiles, canvasViewport, canvasFocusTileId, and actions
2. `src/views/code/CodeRoot.tsx` — render `CodeSurfaceRouter` instead of inline logic
3. `src/views/code/CodeCanvas.tsx` — ensure it works when rendered inside a tile (may need minor style adjustments)
4. `src/shell/ShellApp.tsx` — no changes (still routes `code` → `CodeRoot`)

**Acceptance criteria:**
- [ ] Can toggle workspace between Thread and Canvas via UI dropdown
- [ ] Canvas shows one tile containing the active session
- [ ] Can pan and zoom the canvas with mouse
- [ ] Can send messages in the tile and receive streaming responses
- [ ] Switching back to Thread preserves session state
- [ ] Existing Code mode tests still pass

### Phase 2: Multi-Session + Focus (Week 2)

**Goal:** Multiple tiles, spawn/close tiles, focus mode.

**Files to create:**
1. `src/components/canvas/TileSessionHeader.tsx` — tile chrome with status dot
2. `src/components/canvas/CodeFocusView.tsx` — fullscreen single tile
3. `src/components/canvas/CanvasContextMenu.tsx` — right-click menu

**Files to modify:**
1. `src/views/code/CodeModeStore.ts` — add `autoArrangeCanvasTiles`, ensure zIndex management
2. `src/components/canvas/CodeCanvasView.tsx` — add focus mode support
3. `src/components/canvas/CanvasToolbar.tsx` — add spawn buttons

**Acceptance criteria:**
- [ ] Can spawn multiple session tiles
- [ ] Can close tiles (session remains in store)
- [ ] Can double-click tile to enter focus mode
- [ ] Can exit focus mode via UI button
- [ ] HUD shows live session count
- [ ] Context menu on empty canvas spawns tiles

### Phase 3: Auxiliary Tiles (Week 3)

**Goal:** Preview and diff tiles work.

**Files to create:**
1. `src/components/canvas/CodeCanvasTilePreview.tsx` — wraps `CodePreviewPane`
2. `src/components/canvas/CodeCanvasTileDiff.tsx` — wraps `ChangesetReview`

**Files to modify:**
1. `src/components/canvas/CanvasToolbar.tsx` — enable preview/diff spawn buttons
2. `src/components/canvas/TileContent.tsx` — route tile type to correct component

**Acceptance criteria:**
- [ ] Preview tile renders code preview
- [ ] Diff tile renders changeset review
- [ ] All tile types coexist on canvas

### Phase 4: Polish (Week 4)

**Goal:** Snap-to-grid, drag-from-sidebar, mobile touch support, performance.

**Files to modify:**
1. `src/components/canvas/InfiniteCanvas.tsx` — touch gestures, pinch-zoom
2. `src/components/canvas/CanvasTile.tsx` — snap-to-grid on release
3. `src/views/code/CodeProjectView.tsx` — drag session cards onto canvas

---

## 10. Testing Strategy

### 10.1 Unit Tests

- `CodeModeStore` canvas actions: `addCanvasTile`, `removeCanvasTile`, `updateCanvasTile`, `setCanvasViewport`
- `InfiniteCanvas` transform math: pan offset calculations, zoom clamping
- `CanvasTile` drag/resize: pointer event handlers, snap-to-grid

### 10.2 Integration Tests

- Toggle Thread ↔ Canvas preserves session messages
- Send message in canvas tile → message appears in tile → message persists when switching to Thread
- Create session in canvas → session appears in workspace sidebar
- Close tile → session still accessible in Thread view

### 10.3 E2E Tests

- Full flow: Open code workspace → switch to canvas → spawn 2 sessions → send messages to both → zoom out → pan → switch to thread → verify both sessions exist

---

## 11. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Performance with 10+ tiles** | Medium | High | Virtualize off-screen tiles (unmount when far outside viewport). Use `IntersectionObserver`. |
| **Message streaming conflicts** | Low | High | Each tile uses independent `sendMessageStream` call. Backend already supports concurrent sessions. |
| **Store bloat from canvas metadata** | Low | Medium | Canvas metadata is small (coordinates + IDs). localStorage limit is ~5MB. |
| **Breaking existing CodeCanvas** | Medium | High | Phase 1 extracts `CodeThreadView` without changing `CodeCanvas`. Existing tests validate. |
| **Mobile touch interactions** | Medium | Medium | Phase 4 addresses touch. Phase 1-3 are desktop-first. |
| **CSS transform browser bugs** | Low | Low | Use standard `transform: translate() scale()`. Well-supported. |

---

## 12. Open Questions

1. **Should canvas layout sync across devices?**  
   *Recommendation:* No. Keep it local-only like window positions.

2. **Should we support linking tiles (e.g., output of one session feeds input to another)?**  
   *Recommendation:* Phase 4+ feature. Not in initial spec.

3. **Should the canvas have a "presentation mode" (hide chrome, full tiles)?**  
   *Recommendation:* Future enhancement. Focus mode on a single tile covers 80% of use case.

4. **Should we use `framer-motion` for canvas animations?**  
   *Recommendation:* No. Canvas pan/zoom needs 60fps. Use CSS transforms + `requestAnimationFrame` for animations. `framer-motion` is already in the project but is overkill for canvas transforms.

---

## 13. Appendix: Exact File Inventory

### New Files (17)

```
surfaces/allternit-platform/src/
├── views/code/
│   ├── CodeSurfaceRouter.tsx
│   ├── CodeThreadView.tsx
│   ├── CodeCanvasView.tsx
│   └── CodeFocusView.tsx
└── components/canvas/
    ├── InfiniteCanvas.tsx
    ├── CanvasGrid.tsx
    ├── CanvasTile.tsx
    ├── CanvasToolbar.tsx
    ├── CanvasHUD.tsx
    ├── CanvasContextMenu.tsx
    ├── TileSessionHeader.tsx
    ├── TileContent.tsx
    ├── CodeCanvasTileSession.tsx
    ├── CodeCanvasTilePreview.tsx
    ├── CodeCanvasTileDiff.tsx
    ├── CompactChatComposer.tsx
    └── index.ts
```

### Modified Files (4)

```
surfaces/allternit-platform/src/
├── views/code/
│   ├── CodeModeStore.ts          (+ layoutMode, canvasTiles, canvasViewport, canvasFocusTileId, 6 actions)
│   ├── CodeRoot.tsx              (render CodeSurfaceRouter)
│   └── CodeCanvas.tsx            (minor style adjustments for tile embedding)
└── shell/
    └── ShellApp.tsx              (no changes expected — validation only)
```

---

## 14. Conclusion

This specification adds an infinite canvas view to Allternit Code mode by:

1. **Extending** `CodeModeStore` with canvas layout metadata (no new store)
2. **Wrapping** existing `CodeCanvas` conversation components in draggable tiles
3. **Building** a lightweight pan/zoom canvas engine using CSS transforms
4. **Preserving** the existing single-thread experience as the default
5. **Avoiding** hotkeys, backend changes, and competing state

The result is a Nyx-inspired multi-session canvas that feels native to Allternit's existing architecture.
