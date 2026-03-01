# Electron Host Plan

**Created**: 2024-01-16
**Status**: Phase 1 - In Progress
**Based on Ledger**: `TAURI_TO_ELECTRON_LEDGER.md`

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  BrowserWindow (Shell UI Container)                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │  React/Vite UI (A2rchitech Shell)                               │   │  │
│  │  │  - Canvas with capsules                                         │   │  │
│  │  │  - Tab bar, navigation                                         │   │  │
│  │  │  - A2UI adapters                                               │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                         │  │
│  │  IPC Layer (preload.js contextBridge)                                  │  │
│  │  - browser: namespace for tab/browser IPC                             │  │
│  │  - shell: namespace for shell operations                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  BrowserView (Stage Slot) - HUMAN renderer                            │  │
│  │  - Attached to Stage bounds when in HUMAN mode                        │  │
│  │  - Managed via browser:* IPC commands                                 │  │
│  │  - Events sent via browser:* channels                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Directory Structure

```
apps/shell-electron/
├── package.json              # Electron deps, scripts
├── tsconfig.json             # TypeScript config for main/preload
├── vite.config.ts            # Vite config for dev server integration
├── main/
│   └── index.ts              # Electron main process
├── preload/
│   └── index.ts              # ContextBridge API
├── src/
│   └── browser/
│       ├── BrowserManager.ts # BrowserView lifecycle
│       ├── TabManager.ts     # Tab abstraction
│       └── StageHost.ts      # Stage bounds management
└── resources/
    └── icon.icns             # App icon (platform-specific)
```

## 3. Dependencies

### package.json

```json
{
  "name": "@a2rchitech/shell-electron",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main/index.js",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:electron\" \"npm run dev:ui\"",
    "dev:electron": "tsx watch main/index.ts",
    "dev:ui": "cd ../shell && npm run dev",
    "build": "npm run build:ui && npm run build:electron",
    "build:ui": "cd ../shell && npm run build",
    "build:electron": "tsc -p tsconfig.json",
    "start": "electron ."
  },
  "dependencies": {
    "electron": "^28.0.0"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0"
  }
}
```

## 4. Main Process Implementation

### main/index.ts

```typescript
import { app, BrowserWindow, BrowserView, ipcMain, shell } from 'electron';
import { createBrowserManager } from './browser/BrowserManager.js';
import { createTabManager } from './browser/TabManager.js';
import { setupIPC } from './preload/index.js';

let mainWindow: BrowserWindow | null = null;
let browserManager: ReturnType<typeof createBrowserManager> | null = null;
let tabManager: ReturnType<typeof createTabManager> | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    fullscreen: false,
    title: 'A2rchitech Shell',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: `${app.getAppPath()}/dist/preload/index.js`,
    },
  });

  // Load the React UI
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile('../shell/dist/index.html');
  }

  // Initialize managers
  browserManager = createBrowserManager(mainWindow);
  tabManager = createTabManager();

  // Setup IPC handlers
  setupIPC({
    browserManager,
    tabManager,
    mainWindow,
  });

  // Handle new window requests from web content
  mainWindow.webContents.setWindowOpenHandler((details) => {
    return { action: 'deny' }; // We handle via our tab model
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### browser/BrowserManager.ts

```typescript
import { BrowserWindow, BrowserView, Rectangle } from 'electron';

interface BrowserManager {
  createTab(tabId: string, url?: string): void;
  closeTab(tabId: string): void;
  navigate(tabId: string, url: string): Promise<void>;
  goBack(tabId: string): void;
  goForward(tabId: string): void;
  reload(tabId: string): void;
  attachToStage(tabId: string, bounds: Rectangle): void;
  detachFromStage(tabId: string): void;
  setStageBounds(tabId: string, bounds: Rectangle): void;
  getTabBounds(tabId: string): Rectangle | null;
}

export function createBrowserManager(window: BrowserWindow) {
  const tabs = new Map<string, BrowserView>();
  const currentTabId = new Map<string, string>();

  return {
    createTab(tabId: string, url?: string) {
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: 'persist:browser',
        },
      });

      tabs.set(tabId, view);

      if (url) {
        view.webContents.loadURL(url);
      }

      // Set up navigation event handlers
      view.webContents.on('did-navigate', (event, navigatedUrl) => {
        window.webContents.send('browser:didNavigate', { tabId, url: navigatedUrl });
      });

      view.webContents.on('page-title-updated', (event, title) => {
        window.webContents.send('browser:titleUpdated', { tabId, title });
      });

      view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        window.webContents.send('browser:didFailLoad', { tabId, errorCode, errorDescription });
      });

      view.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        window.webContents.send('browser:newTabRequested', { tabId, url });
      });
    },

    closeTab(tabId: string) {
      const view = tabs.get(tabId);
      if (view) {
        if (window.getBrowserView() === view) {
          window.setBrowserView(null);
        }
        view.webContents.destroy();
        tabs.delete(tabId);
      }
    },

    async navigate(tabId: string, url: string) {
      const view = tabs.get(tabId);
      if (view) {
        await view.webContents.loadURL(url);
      }
    },

    goBack(tabId: string) {
      const view = tabs.get(tabId);
      if (view && view.webContents.canGoBack()) {
        view.webContents.goBack();
      }
    },

    goForward(tabId: string) {
      const view = tabs.get(tabId);
      if (view && view.webContents.canGoForward()) {
        view.webContents.goForward();
      }
    },

    reload(tabId: string) {
      const view = tabs.get(tabId);
      if (view) {
        view.webContents.reload();
      }
    },

    attachToStage(tabId: string, bounds: Rectangle) {
      const view = tabs.get(tabId);
      if (view) {
        window.setBrowserView(view);
        view.setBounds(bounds);
        view.setAutoResize({ width: true, height: true });
      }
    },

    detachFromStage(tabId: string) {
      const view = tabs.get(tabId);
      if (view && window.getBrowserView() === view) {
        window.setBrowserView(null);
      }
    },

    setStageBounds(tabId: string, bounds: Rectangle) {
      const view = tabs.get(tabId);
      if (view && window.getBrowserView() === view) {
        view.setBounds(bounds);
      }
    },

    getTabBounds(tabId: string): Rectangle | null {
      const view = tabs.get(tabId);
      if (view) {
        return view.getBounds();
      }
      return null;
    },
  };
}
```

### preload/index.ts

```typescript
import { contextBridge, ipcRenderer } from 'electron';

export function setupIPC(managers: {
  browserManager: any;
  tabManager: any;
  mainWindow: any;
}) {
  const browserHandlers = {
    // Tab management
    async createTab(url?: string) {
      const tabId = crypto.randomUUID();
      const result = await ipcRenderer.invoke('browser:createTab', { tabId, url });
      return result;
    },

    async closeTab(tabId: string) {
      return ipcRenderer.invoke('browser:closeTab', { tabId });
    },

    // Navigation
    async navigate(tabId: string, url: string) {
      return ipcRenderer.invoke('browser:navigate', { tabId, url });
    },

    goBack(tabId: string) {
      ipcRenderer.send('browser:goBack', { tabId });
    },

    goForward(tabId: string) {
      ipcRenderer.send('browser:goForward', { tabId });
    },

    reload(tabId: string) {
      ipcRenderer.send('browser:reload', { tabId });
    },

    // Stage management
    attachToStage(tabId: string, bounds: Electron.Rectangle) {
      ipcRenderer.send('browser:attachStage', { tabId, bounds });
    },

    detachFromStage(tabId: string) {
      ipcRenderer.send('browser:detachStage', { tabId });
    },

    setStageBounds(tabId: string, bounds: Electron.Rectangle) {
      ipcRenderer.send('browser:setStageBounds', { tabId, bounds });
    },

    // Events (subscribe)
    onDidNavigate(callback: (data: { tabId: string; url: string }) => void) {
      ipcRenderer.on('browser:didNavigate', (_, data) => callback(data));
    },

    onTitleUpdated(callback: (data: { tabId: string; title: string }) => void) {
      ipcRenderer.on('browser:titleUpdated', (_, data) => callback(data));
    },

    onDidFailLoad(callback: (data: { tabId: string; errorCode: number; errorDescription: string }) => void) {
      ipcRenderer.on('browser:didFailLoad', (_, data) => callback(data));
    },

    onNewTabRequested(callback: (data: { tabId: string; url: string }) => void) {
      ipcRenderer.on('browser:newTabRequested', (_, data) => callback(data));
    },
  };

  contextBridge.exposeInMainWorld('a2Browser', browserHandlers);
}
```

## 5. Run Commands

### Development

```bash
# Terminal 1: Start Electron with hot reload
cd apps/shell-electron
npm run dev:electron

# Terminal 2: Start React UI dev server
cd apps/shell
npm run dev

# Or run both together
cd apps/shell-electron
npm run dev
```

### Production Build

```bash
cd apps/shell-electron
npm run build
npm start
```

## 6. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_DEV_SERVER_URL` | `http://localhost:5173` | React dev server URL |
| `A2_HOST` | `electron` | Host type (electron/tauri) |

## 7. Feature Flags

To maintain compatibility during migration:

```typescript
// In React UI
const HOST = import.meta.env.VITE_HOST || 'electron';

// Conditional rendering based on host
if (HOST === 'tauri') {
  // Use Tauri-specific code
} else {
  // Use Electron-specific code
}
```

## 8. Known Limitations & Open Questions

| Item | Status | Notes |
|---|---|---|
| Cookie sharing with Playwright | `unmapped` | Need shared partition strategy |
| Native menus | `unmapped` | Not in current Tauri either |
| File dialogs | `unmapped` | Electron dialog API |
| Shortcuts | `unmapped` | globalShortcut API |
| Deep links | `unmapped` | Protocol handler |

## 9. Validation Checklist

- [ ] Electron app launches successfully
- [ ] React UI loads and renders
- [ ] BrowserView can be created
- [ ] Tab navigation works
- [ ] Stage attachment/detachment works
- [ ] Events flow from BrowserView to UI
- [ ] No Tauri references in built app

---

*Document maintained as part of Tauri → Electron migration*
