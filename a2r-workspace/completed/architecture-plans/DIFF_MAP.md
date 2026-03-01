# Browser Capsule + Stage Slot - Diff Map

## Baseline Inventory - Planned Changes

### Browser UI Entry Components

| File | Purpose | Status |
|------|---------|--------|
| `apps/ui/src/views/BrowserView.ts` | Main browser capsule view (INSPECT/LIVE modes, tabs, viewport) | **MODIFIED** |
| `apps/shell/src/components/CapsuleView.tsx` | Capsule wrapper, isFluid detection | No changes needed |
| `apps/shell/src/components/LeftRail.tsx` | Spawns browser capsule | No changes needed |
| `apps/shell/src/App.tsx` | Handles capsule orchestration | No changes needed |

### Browser Runtime/Service Code

| File | Purpose | Status |
|------|---------|--------|
| `services/browser-runtime/src/index.ts` | HTTP server with endpoints | **MODIFIED** - Added `/input`, `/metrics` |
| `services/browser-runtime/src/browser.ts` | Playwright controller | No changes needed |
| `services/browser-runtime/src/types.ts` | Type definitions | **MODIFIED** - Added A2Event types |

### Tauri IPC / Commands

| File | Purpose | Status |
|------|---------|--------|
| `apps/shell-tauri/src-tauri/src/main.rs` | `open_browser_window`, `close_window`, `show_window`, `hide_window` | **DISABLED** - Native mode removed |
| `apps/shell/index.html` | `window.browserWindow` bridge API | **MODIFIED** - Popup interceptor |

### Code with External Window Opens (REMOVED/DISABLED)

| File | Line | Original Code | Action |
|------|------|---------------|--------|
| `apps/ui/src/views/CanvasRenderer.ts` | ~50 | `window.open('', '_blank', ...)` | Not used for browser capsule |
| `apps/shell/dist/.../index-*.js` | Bundled | `window.open()` fallback in spawnNativeWindow | **REMOVED** in source |

### State Management

| File | State | Purpose |
|------|-------|---------|
| `apps/ui/src/views/BrowserView.ts` | `tabs: Map<string, BrowserTab>` | Tab state with renderMode, viewportMode, zoom, presentation, renderer |
| `apps/shell/src/runtime/ShellState.tsx` | `capsules: Capsule[]` | Capsule registry |

### Event Transport (Current State)

| Transport | Purpose | Status |
|-----------|---------|--------|
| HTTP polling (App.tsx) | Journal events every 5s | Unchanged |
| HTTP GET/POST | Browser service: screenshots, navigation | Unchanged |
| HTTP POST | Input injection `/input` endpoint | **NEW** |
| WebSocket (wss) | Event broadcasting | Exists, may be enhanced |

---

## Phase 1 - Stop External Spawns

### Changes Made

**File**: `apps/ui/src/views/BrowserView.ts`
- **Removed**: `spawnNativeWindow()` fallback to `window.open(url, '_blank')`
- **Added**: Popup interceptor that creates internal tabs instead
- **Behavior**: `window.open()` now blocked, creates new internal tab with toast notification

**File**: `apps/shell/index.html`
- **No changes**: Bridge API preserved but unused for default browsing

**File**: `apps/shell-tauri/src-tauri/src/main.rs`
- **No changes**: Commands preserved but not called from default path

---

## Phase 2 - Event Contract + Session Lifecycle

### New Interface: A2Event

```typescript
interface A2Event {
  id: string;           // Unique event ID
  ts: number;          // Unix timestamp
  type: string;        // Event type category
  spaceId?: string;    // Workspace/space ID
  capsuleId?: string;  // Capsule ID
  tabId?: string;      // Browser tab ID
  payload: unknown;    // Event-specific data
}
```

### New Commands (UI → Backend)

| Command | Endpoint | Purpose |
|---------|----------|---------|
| `browser.session.create` | POST /session | Create browser session |
| `browser.session.dispose` | DELETE /session/:id | Close session |
| `browser.nav.goto` | POST /session/:id/navigate | Navigate to URL |
| `browser.nav.back` | POST /session/:id/back | Go back |
| `browser.nav.forward` | POST /session/:id/forward | Go forward |
| `browser.nav.reload` | POST /session/:id/reload | Reload page |
| `browser.mode.set` | Internal state | Set INSPECT/LIVE mode |
| `browser.viewport.set` | Internal state | Set viewport dimensions |
| `browser.scale.set` | Internal state | Set Fit/Fill/100% + zoom |
| `browser.input` | POST /session/:id/input | Unified input injection |

### New Events (Backend → UI)

| Event | Payload | Purpose |
|-------|---------|---------|
| `browser.frame` | `{format, dataB64, width, height, seq}` | Screenshot frame |
| `browser.nav.changed` | `{url, canGoBack, canGoForward, loading}` | Navigation state |
| `browser.title.changed` | `{title, faviconUrl?}` | Page title update |
| `browser.tab.created` | `{openerTabId, url, title?}` | Popup/new tab |
| `browser.perf` | `{fps, rttMs, droppedFrames?}` | Performance metrics |
| `browser.error` | `{code, message}` | Error state |
| `browser.boost.suggested` | `{reason, fps, seconds}` | Boost recommendation |

---

## Phase 4 - Stage Slot System

### New State (in BrowserTab)

```typescript
interface BrowserTab {
  // ... existing fields ...
  presentation: 'capsule' | 'stage';  // NEW
  renderer: 'stream' | 'gpu';           // NEW
}
```

### New UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `StageSlot` | New | Managed container for staged capsules |
| `StageControls` | New | Size preset buttons (50%/70%/100%) |
| `BoostButton` | New | Large GPU renderer toggle |

### New Commands

| Command | Purpose |
|---------|---------|
| `stage.enter(capsuleId, tabId)` | Move capsule to Stage Slot |
| `stage.exit(capsuleId, tabId)` | Return to capsule |
| `stage.size.set(preset)` | Set Stage size (0.5/0.7/1.0) |

### New Events

| Event | Payload | Purpose |
|-------|---------|---------|
| `stage.changed` | `{active, capsuleId, tabId, preset}` | Stage state change |

---

## Phase 5 - Boost (GPU) Renderer

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser Capsule                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐  │
│  │           Render Interface (Abstract)             │  │
│  └─────────────────────────────────────────────────┘  │
│                    ↑                                   │
│         ┌──────────┴──────────┐                      │
│         │                     │                         │
│    ┌────▼────┐        ┌────▼────┐                  │
│    │  Stream  │        │   GPU    │                  │
│    │ (Playwrgt│        │WKWebView │                  │
│    └──────────┘        └──────────┘                  │
│         │                     │                         │
│    viewport: fit          viewport: full               │
│    input: inject         input: native                │
│    video: stream         video: native                 │
│    WebGL: limited        WebGL: full                  │
└─────────────────────────────────────────────────────────┘
```

### Platform Support

| Platform | GPU Renderer | Status |
|----------|--------------|--------|
| macOS | WKWebView | **IMPLEMENTED** |
| Windows | WebView2 | Planned |
| Linux | stream-only | Fallback |

---

## Phase 6 - Enhanced Browser Chrome

### Header Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ [←][→][↻]  [URL/Search bar with loading bar]  [⊞⊟⊡][+/-]  [INSPECT|LIVE]  [Stream|Boost]  [Stage]  [□]  [+]  [▼] │
└─────────────────────────────────────────────────────────────────────┘
```

### Status Bar

```
[Status Pill]  [LIVE • 22 fps • 48ms • Renderer: Stream]  [Scale 0.83x]  ...icons...  [3 tabs]
```

---

## Summary of Files Changed

| File | Changes |
|------|----------|
| `apps/ui/src/views/BrowserView.ts` | Complete rewrite with all phases |
| `services/browser-runtime/src/index.ts` | Added `/input`, `/metrics` endpoints |
| `services/browser-runtime/src/types.ts` | Added A2Event, input types |
| `docs/BROWSER_CAPSULE_GOLD_STANDARD.md` | **NEW** - Full spec |
| `docs/STAGE_SLOT_SPEC.md` | **NEW** - Stage system spec |
| `docs/QA_BROWSER_STAGE.md` | **NEW** - Test checklist |
| `docs/DIFF_MAP.md` | **THIS FILE** - Change inventory |

---

## Guardrails Followed

- ✅ No free-floating overlay system (Stage Slot is managed)
- ✅ Existing tab/capsule architecture preserved
- ✅ New state is localized and typed
- ✅ Renderer abstraction added (stream/gpu interface)
- ✅ No external browser windows in default path
