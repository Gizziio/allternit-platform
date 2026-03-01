# A2rchitech Browser Capsule - Gold Standard Specification

## Overview

The Browser Capsule is a "Gold Standard" capsule that provides embedded web browsing within the A2rchitech shell. It features dual-mode operation (INSPECT/LIVE), internal tab management, and seamless integration with the shell's spatial UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Capsule UI                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Header: Nav + URL + Viewport Controls + Mode Toggle + Tabs │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Webview Container                       │  │  │
│  │  │  ┌─────────────────────────────────────────────┐    │  │  │
│  │  │  │         Screenshot/Stream                   │    │  │  │
│  │  │  │         (Playwright → Frontend)             │    │  │  │
│  │  │  └─────────────────────────────────────────────┘    │  │  │
│  │  │                    ↑                                │  │  │
│  │  │         Input Overlay (captures mouse/keyboard)     │  │  │
│  │  │                    ↑                                │  │  │
│  │  │         Coordinate Translation Layer                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │ Status Bar: Status Pill + Mode/FPS Indicator + Tab Count  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ↓                  ↓                  ↓
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Browser Runtime │ │   Shell State   │ │   Tauri IPC     │
│ (Playwright)    │ │  (CapsuleView)  │ │  (Window Mgmt)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Browser States

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| `connecting` | ○ | Yellow | Connecting to browser service |
| `loading` | ◐ | Blue | Page is loading |
| `ready` | ● | Green | Page loaded and ready |
| `error` | ✕ | Red | Error occurred |

## Interaction Modes

### INSPECT Mode (Default)
- **FPS**: 2 fps (low, for stability)
- **Cursor**: Default (no input capture)
- **Input**: Disabled by default
- **Purpose**: Stable view for reading, agent observation
- **Use case**: When you need a static view to read content or take screenshots

### LIVE Mode
- **FPS**: 20 fps (adaptive)
- **Cursor**: Crosshair (input active)
- **Input**: Full mouse + keyboard capture
- **Purpose**: Interactive browsing with real-time feedback
- **Use case**: When you need to click, type, or interact with page elements

## Viewport Modes

| Mode | Icon | Behavior |
|------|------|----------|
| `fit` | ⊞ | Contain - entire page visible, may have letterboxing |
| `fill` | ⊟ | Cover - fills viewport, may crop edges |
| `100%` | ⊡ | 100% - native resolution with zoom controls |

## Tab Behavior Rules

### No External Windows (Critical)
- **target="_blank"** links → Open as new internal tab
- **window.open()** calls → Intercepted, open as new internal tab
- **No fallbacks** to system browser allowed

### Tab Lifecycle
```
User clicks link → Create new tab element with animation
                  → Navigate headless session to URL
                  → Update screenshot stream
                  → Show toast notification
```

## Event Contracts

### Frontend → Browser Runtime

#### Create Session
```typescript
POST /session
Body: { url?: string, width?: number, height?: number }
Response: { sessionId: string }
```

#### Navigate
```typescript
POST /session/:id/navigate
Body: { url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }
Response: { url: string }
```

#### Unified Input (Gold Standard)
```typescript
POST /session/:id/input
Body: {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'wheel' | 'keydown' | 'keyup' | 'text',
  x?: number,           // Mouse X coordinate
  y?: number,           // Mouse Y coordinate
  button?: string,      // Mouse button (left, right, middle)
  deltaX?: number,      // Scroll delta X
  deltaY?: number,      // Scroll delta Y
  key?: string,         // Keyboard key
  text?: string         // Text to type
}
Response: { status: 'ok' }
```

#### Screenshot
```typescript
GET /session/:id/screenshot?format=png | jpeg
Response: PNG/JPEG image binary
```

#### Get Current URL
```typescript
GET /session/:id/url
Response: { url: string }
```

#### Performance Metrics
```typescript
GET /session/:id/metrics
Response: {
  pageLoadTime: number,
  domContentLoaded: number,
  domInteractive: number,
  memoryUsedJSHeap?: number,
  memoryTotalJSHeap?: number,
  url: string,
  title: string,
  timestamp: number
}
```

### Browser Runtime → Frontend (WebSocket)

```typescript
// Screenshot ready
{ type: 'frame', sessionId, data: { url, title }, timestamp }

// Console message
{ type: 'console', sessionId, data: { type, text, location }, timestamp }

// Network request
{ type: 'network', sessionId, data: { id, type, url, method, status, timestamp }, timestamp }

// Page load
{ type: 'load', sessionId, data: { url }, timestamp }

// Popup created (for popup interception)
{ type: 'popup_created', sessionId, data: { openerPageId, popupPageId, url, title, timestamp }, timestamp }
```

## Coordinate System

```
Browser Viewport
┌─────────────────────────────┐
│                             │
│  ┌─────────────────────┐    │  ← Image/Canvas Element
│  │                     │    │
│  │    ● (x, y)        │    │  ← User click at screen position
│  │                     │    │
│  └─────────────────────┘    │
│                             │
└─────────────────────────────┘

Translation:
1. Get click position relative to image: clientX - imgRect.left
2. Scale to actual page dimensions: (position / imgRect) * imageRect
3. Send to browser runtime as absolute coordinates
```

## CSS Design Tokens

```css
:root {
  /* Browser-specific colors */
  --ax-browser-bg: var(--bg-canvas, #f8fafc);
  --ax-browser-header-bg: var(--bg-secondary, #16213e);
  --ax-browser-border: var(--border-color, #0f3460);
  --ax-browser-text: var(--text-primary, #1a1a2e);
  --ax-browser-secondary: var(--text-secondary, #6b7280);

  /* Status colors */
  --ax-status-connecting: #fef3c7;
  --ax-status-connecting-text: #92400e;
  --ax-status-loading: #dbeafe;
  --ax-status-loading-text: #1e40af;
  --ax-status-ready: #d1fae5;
  --ax-status-ready-text: #065f46;
  --ax-status-error: #fee2e2;
  --ax-status-error-text: #991b1b;

  /* Mode colors */
  --ax-mode-inspect: #6b7280;
  --ax-mode-live: #10b981;
  --ax-mode-live-glow: rgba(16, 185, 129, 0.3);
}
```

## Capsule Chrome Contract

All capsules should implement this header structure:

```
┌──────────────────────────────────────────────────────┐
│ [Left] Title/Icon     [Center] Content      [Right] │
│                                                      │
│ Optional: Close, Maximize, Settings buttons          │
│ Optional: Loading/error badges                       │
└──────────────────────────────────────────────────────┘
```

### Required Elements
- **Title area**: Capsule name + icon
- **Status badge slot**: For loading/error states
- **Close button**: Remove capsule from view

### Optional Elements
- **Maximize button**: Expand to full canvas
- **Settings button**: Capsule-specific settings
- **Custom controls**: Per-capsule functionality

## Testing Checklist

### Phase 0: Basic Connectivity
- [ ] Browser service starts successfully
- [ ] Frontend connects to browser service
- [ ] Initial page loads (google.com or specified URL)
- [ ] Screenshot displays in viewport

### Phase 1: Navigation
- [ ] Type URL in omnibox + Enter → Page navigates
- [ ] Back button works
- [ ] Forward button works
- [ ] Reload button works
- [ ] URL bar updates on navigation

### Phase 2: Tab Management
- [ ] New tab button creates blank tab
- [ ] Clicking tab switches to that tab
- [ ] Closing tab (×) removes tab
- [ ] Cannot close last tab
- [ ] Tab count updates in status bar
- [ ] Tab switch has slide-in animation

### Phase 3: Interaction Modes
- [ ] INSPECT mode: Cursor is default (no input)
- [ ] LIVE mode: Cursor is crosshair
- [ ] Click in LIVE mode registers click
- [ ] Type in LIVE mode registers keyboard input
- [ ] Scroll wheel works in LIVE mode
- [ ] Mode toggle switches between modes
- [ ] FPS indicator shows in LIVE mode

### Phase 4: Viewport Controls
- [ ] Fit (contain) mode works
- [ ] Fill (cover) mode works
- [ ] 100% zoom mode works
- [ ] Zoom in/out buttons work
- [ ] Scale badge shows when not 100%

### Phase 5: Popup Interception (Critical)
- [ ] Clicking target=_blank link opens new internal tab
- [ ] Calling window.open() creates new internal tab
- [ ] Toast notification shows on new tab
- [ ] No external browser windows open
- [ ] Popup URL matches expected destination

### Phase 6: Status Indicators
- [ ] Connecting state shows when service unreachable
- [ ] Loading state shows during page load
- [ ] Ready state shows after page loads
- [ ] Error state shows on navigation failure
- [ ] Status pill color matches state

### Phase 7: Visual Polish
- [ ] Tab switch has crossfade animation
- [ ] Mode switch has status glow
- [ ] Click feedback animation works
- [ ] Typing echo shows keystrokes
- [ ] Toast notifications appear and fade

### Phase 8: Error Handling
- [ ] Service down → Graceful "connecting" state
- [ ] Invalid URL → Error state
- [ ] Network timeout → Error state with retry
- [ ] Session closed → Cleanup and reconnect

## Run Commands

```bash
# Start browser runtime
cd services/browser-runtime
pnpm dev

# Start shell (in separate terminal)
cd apps/shell
pnpm dev

# Run with Tauri (in separate terminal)
cd apps/shell-tauri
cargo tauri dev
```

## Debug Commands

```bash
# Check browser service health
curl http://localhost:8001/health

# Get session metrics
curl http://localhost:8001/session/:id/metrics

# Check console for debug logs
# [BrowserView] prefix for frontend logs
# [Browser Runtime] prefix for backend logs
```

## Known Limitations

1. **No WebGL/Video acceleration** - Uses headless screenshots
2. **No DRM playback** - Cannot play Netflix/Disney+ etc.
3. **No audio** - Screenshot-based, no audio streaming
4. **Popup interception** - Only works for same-origin popups
5. **Coordinate precision** - May drift on rapid scrolling

## Future Enhancements (Phase 4)

- **GPU Renderer**: WKWebView/WebView2 for video/WebGL
- **Stage Slot**: Dedicated area for high-performance content
- **AG-UI Integration**: Real-time event streaming via WebSocket
- **A2UI Headers**: Use A2UI for browser header rendering
