# Electron IPC Contract

**Created**: 2024-01-16
**Status**: Phase 2 - Ready for Implementation
**Based on Ledger**: `TAURI_TO_ELECTRON_LEDGER.md`

---

## 1. IPC Namespace Overview

All IPC communication follows the pattern:
- **Main → Renderer**: `ipcRenderer.on(channel, handler)` (events)
- **Renderer → Main**: `ipcRenderer.invoke(channel, data)` (requests)

Channels are namespaced:
- `browser:*` - Tab/Browser operations
- `shell:*` - Shell operations (future)

---

## 2. Browser IPC Channels

### 2.1 Renderer → Main (Requests)

All requests return `Promise<void>` unless otherwise noted.

| Channel | Payload | Response | Purpose |
|---|---|---|---|
| `browser:createTab` | `{ tabId: string; url?: string }` | `Promise<{ tabId: string; success: boolean }>` | Create new tab |
| `browser:closeTab` | `{ tabId: string }` | `Promise<void>` | Close tab |
| `browser:navigate` | `{ tabId: string; url: string }` | `Promise<void>` | Navigate to URL |
| `browser:goBack` | `{ tabId: string }` | `Promise<void>` | Go back in history |
| `browser:goForward` | `{ tabId: string }` | `Promise<void>` | Go forward in history |
| `browser:reload` | `{ tabId: string }` | `Promise<void>` | Reload page |
| `browser:attachStage` | `{ tabId: string; bounds: Rectangle }` | `Promise<void>` | Attach tab to Stage |
| `browser:detachStage` | `{ tabId: string }` | `Promise<void>` | Detach from Stage |
| `browser:setStageBounds` | `{ tabId: string; bounds: Rectangle }` | `Promise<void>` | Resize Stage |

### 2.2 Main → Renderer (Events)

All events are fire-and-forget.

| Channel | Payload | Purpose |
|---|---|---|
| `browser:didNavigate` | `{ tabId: string; url: string }` | Navigation completed |
| `browser:didFinishLoad` | `{ tabId: string; url: string }` | Page finished loading |
| `browser:titleUpdated` | `{ tabId: string; title: string }` | Page title changed |
| `browser:didFailLoad` | `{ tabId: string; errorCode: number; errorDescription: string }` | Load error |
| `browser:newTabRequested` | `{ tabId: string; url: string; target: string }` | Popup/new tab requested |

---

## 3. Payload Schemas

### 3.1 Rectangle

```typescript
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### 3.2 createTab

```typescript
interface CreateTabRequest {
  tabId: string;  // Client-generated UUID
  url?: string;   // Optional initial URL
}

interface CreateTabResponse {
  tabId: string;
  success: boolean;
  error?: string;
}
```

### 3.3 navigate

```typescript
interface NavigateRequest {
  tabId: string;
  url: string;
}
```

### 3.4 didNavigate

```typescript
interface DidNavigateEvent {
  tabId: string;
  url: string;
}
```

### 3.5 didFailLoad

```typescript
interface DidFailLoadEvent {
  tabId: string;
  errorCode: number;
  errorDescription: string;
}
```

### 3.6 newTabRequested

```typescript
interface NewTabRequestedEvent {
  openerTabId: string;
  url: string;
  target: '_blank' | '_self' | '_parent' | '_top';
}
```

---

## 4. Renderer Bridge API

### 4.1 Preload Bridge (`window.a2Browser`)

```typescript
interface A2BrowserAPI {
  // Tab management
  createTab(url?: string): Promise<{ tabId: string; success: boolean }>;
  closeTab(tabId: string): Promise<void>;

  // Navigation
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): void;
  goForward(tabId: string): void;
  reload(tabId: string): void;

  // Stage
  attachStage(tabId: string, bounds: Electron.Rectangle): void;
  detachStage(tabId: string): void;
  setStageBounds(tabId: string, bounds: Electron.Rectangle): void;

  // Event subscriptions
  onDidNavigate(callback: (data: DidNavigateEvent) => void): () => void;
  onTitleUpdated(callback: (data: { tabId: string; title: string }) => void): () => void;
  onDidFailLoad(callback: (data: DidFailLoadEvent) => void): () => void;
  onNewTabRequested(callback: (data: NewTabRequestedEvent) => void): () => void;
}
```

### 4.2 Usage Example

```typescript
// Create a tab
const { tabId } = await window.a2Browser.createTab('https://example.com');

// Navigate
await window.a2Browser.navigate(tabId, 'https://google.com');

// Subscribe to events
const unsub = window.a2Browser.onDidNavigate((event) => {
  console.log(`Tab ${event.tabId} navigated to ${event.url}`);
});

// Cleanup
unsub();
```

---

## 5. Main Process Handler Implementation

### 5.1 Handler Template

```typescript
// main/browser/BrowserHandlers.ts
import { ipcMain, BrowserWindow } from 'electron';
import type { Rectangle } from 'electron/main';

interface BrowserHandlers {
  createTab: (event: Electron.IpcMainEvent, payload: { tabId: string; url?: string }) => Promise<void>;
  closeTab: (event: Electron.IpcMainEvent, payload: { tabId: string }) => Promise<void>;
  navigate: (event: Electron.IpcMainEvent, payload: { tabId: string; url: string }) => Promise<void>;
  goBack: (event: Electron.IpcMainEvent, payload: { tabId: string }) => void;
  goForward: (event: Electron.IpcMainEvent, payload: { tabId: string }) => void;
  reload: (event: Electron.IpcMainEvent, payload: { tabId: string }) => void;
  attachStage: (event: Electron.IpcMainEvent, payload: { tabId: string; bounds: Rectangle }) => void;
  detachStage: (event: Electron.IpcMainEvent, payload: { tabId: string }) => void;
  setStageBounds: (event: Electron.IpcMainEvent, payload: { tabId: string; bounds: Rectangle }) => void;
}

export function setupBrowserHandlers(mainWindow: BrowserWindow, browserManager: any) {
  ipcMain.handle('browser:createTab', async (event, { tabId, url }) => {
    browserManager.createTab(tabId, url);
    event.reply('browser:createTab:response', { tabId, success: true });
  });

  ipcMain.handle('browser:closeTab', async (event, { tabId }) => {
    browserManager.closeTab(tabId);
  });

  ipcMain.handle('browser:navigate', async (event, { tabId, url }) => {
    await browserManager.navigate(tabId, url);
  });

  ipcMain.handle('browser:goBack', (event, { tabId }) => {
    browserManager.goBack(tabId);
  });

  ipcMain.handle('browser:goForward', (event, { tabId }) => {
    browserManager.goForward(tabId);
  });

  ipcMain.handle('browser:reload', (event, { tabId }) => {
    browserManager.reload(tabId);
  });

  ipcMain.handle('browser:attachStage', (event, { tabId, bounds }) => {
    browserManager.attachToStage(tabId, bounds);
  });

  ipcMain.handle('browser:detachStage', (event, { tabId }) => {
    browserManager.detachFromStage(tabId);
  });

  ipcMain.handle('browser:setStageBounds', (event, { tabId, bounds }) => {
    browserManager.setStageBounds(tabId, bounds);
  });
}
```

---

## 6. Error Handling

### 6.1 Error Codes

| Code | Meaning | Handling |
|---|---|---|
| `TAB_NOT_FOUND` | Tab ID doesn't exist | Client should handle invalid tab |
| `NAVIGATION_FAILED` | Failed to load URL | `didFailLoad` event emitted |
| `VIEW_DESTROYED` | BrowserView was destroyed | Close tab, notify client |
| `INVALID_BOUNDS` | Rectangle is invalid | Clamp to valid bounds |

### 6.2 Error Event

```typescript
interface BrowserErrorEvent {
  tabId: string;
  code: 'TAB_NOT_FOUND' | 'NAVIGATION_FAILED' | 'VIEW_DESTROYED' | 'INVALID_BOUNDS';
  message: string;
}
```

---

## 7. Security Considerations

### 7.1 Context Isolation

All IPC goes through `contextBridge`:
- Renderer cannot access `ipcRenderer` directly
- Only exposed APIs are available via `window.a2Browser`

### 7.2 URL Validation

Main process should validate URLs:

```typescript
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Block dangerous protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### 7.3 Window Open Policy

All `target=_blank` requests are intercepted:

```typescript
view.webContents.on('new-window', (event, url) => {
  event.preventDefault();
  mainWindow.webContents.send('browser:newTabRequested', {
    openerTabId: tabId,
    url,
    target: '_blank',
  });
});
```

---

## 8. Migration from Tauri

### 8.1 Tauri → Electron Mapping

| Tauri API | Electron Equivalent |
|---|---|
| `window.__TAURI__.invoke()` | `ipcRenderer.invoke()` |
| `window.__TAURI__.event.emit()` | `ipcMain.handle()` |
| `window.__TAURI__.webview` | `BrowserView` |
| `tauri.conf.json windows[]` | `new BrowserWindow()` |

### 8.2 Capsule SDK Action Mapping

| Capsule SDK Action | IPC Channel |
|---|---|
| `browser.renderer.human` | `browser:attachStage` |
| `browser.renderer.agent` | (handled by Playwright service) |
| `browser.stage.enter` | `browser:attachStage` |
| `browser.stage.exit` | `browser:detachStage` |
| `browser.nav.back` | `browser:goBack` |
| `browser.nav.forward` | `browser:goForward` |
| `browser.nav.go(url)` | `browser:navigate` |

---

## 9. Testing Checklist

- [ ] All request channels handle invalid payloads
- [ ] Events are received in correct order
- [ ] Tab lifecycle (create → navigate → close) works
- [ ] Stage attach/detach works without visual artifacts
- [ ] Resize during Stage works smoothly
- [ ] New window requests route to tab model
- [ ] Error cases are handled gracefully

---

*Document maintained as part of Tauri → Electron migration*
