# T3-A1: Window Management

## Agent Role
Electron Window Architect

## Task
Create robust multi-window management with state persistence for the Electron app.

## Deliverables

### 1. Window Manager Module

Create: `7-apps/shell/desktop/main/window/`

```
main/window/
├── index.ts
├── WindowManager.ts       # Main window manager class
├── createWindow.ts        # Window creation factory
├── window-state.ts        # State persistence
├── window-menu.ts         # Window-specific menus
└── window-shortcuts.ts    # Window shortcuts
```

### 2. Window Manager Class

Create: `7-apps/shell/desktop/main/window/WindowManager.ts`

```typescript
import { BrowserWindow, screen } from 'electron';

interface WindowConfig {
  id?: string;
  url?: string;
  bounds?: Electron.Rectangle;
  maximized?: boolean;
  fullscreen?: boolean;
  alwaysOnTop?: boolean;
}

interface ManagedWindow {
  id: string;
  window: BrowserWindow;
  config: WindowConfig;
}

export class WindowManager {
  private windows = new Map<string, ManagedWindow>();
  private focusedWindowId: string | null = null;
  
  async createWindow(config: WindowConfig = {}): Promise<BrowserWindow> {
    const windowId = config.id || nanoid();
    const windowState = await this.getWindowState(windowId);
    
    const window = new BrowserWindow({
      width: config.bounds?.width || windowState?.bounds?.width || 1280,
      height: config.bounds?.height || windowState?.bounds?.height || 800,
      x: config.bounds?.x || windowState?.bounds?.x,
      y: config.bounds?.y || windowState?.bounds?.y,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload/index.js'),
      },
      show: false, // Show after ready-to-show
    });
    
    // Restore state
    if (windowState?.maximized) {
      window.maximize();
    }
    if (config.fullscreen || windowState?.fullscreen) {
      window.setFullScreen(true);
    }
    if (config.alwaysOnTop) {
      window.setAlwaysOnTop(true);
    }
    
    // Load URL
    const url = config.url || this.getDefaultUrl();
    await window.loadURL(url);
    
    // Show when ready
    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });
    
    // Track window
    this.windows.set(windowId, { id: windowId, window, config });
    this.setupWindowEvents(window, windowId);
    
    return window;
  }
  
  private setupWindowEvents(window: BrowserWindow, id: string): void {
    // Focus tracking
    window.on('focus', () => {
      this.focusedWindowId = id;
    });
    
    // State saving
    const saveState = debounce(() => {
      this.saveWindowState(id, {
        bounds: window.getBounds(),
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen(),
      });
    }, 500);
    
    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);
    
    // Cleanup on close
    window.on('closed', () => {
      this.windows.delete(id);
      if (this.focusedWindowId === id) {
        this.focusedWindowId = null;
      }
    });
  }
  
  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id)?.window;
  }
  
  getFocusedWindow(): BrowserWindow | undefined {
    return this.focusedWindowId ? this.getWindow(this.focusedWindowId) : undefined;
  }
  
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values()).map(w => w.window);
  }
  
  closeWindow(id: string): void {
    const managed = this.windows.get(id);
    if (managed) {
      managed.window.close();
    }
  }
  
  closeAllWindows(): void {
    this.getAllWindows().forEach(window => window.close());
  }
  
  private async getWindowState(id: string): Promise<WindowState | null> {
    // Load from electron-store or file
    return store.get(`window-state.${id}`) || null;
  }
  
  private async saveWindowState(id: string, state: WindowState): Promise<void> {
    store.set(`window-state.${id}`, state);
  }
  
  private getDefaultUrl(): string {
    if (isDev) {
      return 'http://localhost:5177';
    }
    return `file://${path.join(__dirname, '../renderer/index.html')}`;
  }
}

export const windowManager = new WindowManager();
```

### 3. Window State Persistence

Create: `7-apps/shell/desktop/main/window/window-state.ts`

```typescript
import Store from 'electron-store';

interface WindowState {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  maximized: boolean;
  fullscreen: boolean;
  displayId?: string;
}

interface WindowStateSchema {
  'window-state': {
    [windowId: string]: WindowState;
  };
  'last-window-state': WindowState;
}

const store = new Store<WindowStateSchema>({
  name: 'window-state',
  defaults: {
    'window-state': {},
    'last-window-state': {
      bounds: { x: 100, y: 100, width: 1280, height: 800 },
      maximized: false,
      fullscreen: false,
    },
  },
});

export function getWindowState(windowId: string): WindowState | undefined {
  return store.get(`window-state.${windowId}`);
}

export function setWindowState(windowId: string, state: WindowState): void {
  store.set(`window-state.${windowId}`, state);
  store.set('last-window-state', state);
}

export function getLastWindowState(): WindowState {
  return store.get('last-window-state');
}

export function clearWindowState(windowId: string): void {
  store.delete(`window-state.${windowId}` as any);
}

// Multi-monitor support
export function getDisplayForWindow(bounds: Electron.Rectangle): Electron.Display {
  return screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
}

export function ensureWindowVisible(bounds: Electron.Rectangle): Electron.Rectangle {
  const display = getDisplayForWindow(bounds);
  const { width, height } = display.workAreaSize;
  
  return {
    x: Math.max(0, Math.min(bounds.x, width - 200)),
    y: Math.max(0, Math.min(bounds.y, height - 200)),
    width: Math.min(bounds.width, width),
    height: Math.min(bounds.height, height),
  };
}
```

### 4. Window Factory

Create: `7-apps/shell/desktop/main/window/createWindow.ts`

```typescript
interface CreateWindowOptions {
  type?: 'main' | 'settings' | 'about' | 'popout';
  url?: string;
  parent?: BrowserWindow;
  modal?: boolean;
}

export async function createWindow(options: CreateWindowOptions = {}): Promise<BrowserWindow> {
  const { type = 'main' } = options;
  
  switch (type) {
    case 'main':
      return createMainWindow(options);
    case 'settings':
      return createSettingsWindow(options);
    case 'about':
      return createAboutWindow(options);
    case 'popout':
      return createPopoutWindow(options);
    default:
      throw new Error(`Unknown window type: ${type}`);
  }
}

function createMainWindow(options: CreateWindowOptions): BrowserWindow {
  return windowManager.createWindow({
    url: options.url,
    bounds: getLastWindowState().bounds,
  });
}

function createSettingsWindow(options: CreateWindowOptions): BrowserWindow {
  const parent = options.parent;
  
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    parent,
    modal: options.modal ?? true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
    },
  });
  
  window.loadURL(`${getDefaultUrl()}/settings`);
  
  return window;
}

function createAboutWindow(options: CreateWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    minimizable: false,
    maximizable: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
    },
  });
  
  window.loadURL(`${getDefaultUrl()}/about`);
  
  return window;
}

function createPopoutWindow(options: CreateWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
    },
  });
  
  if (options.url) {
    window.loadURL(options.url);
  }
  
  return window;
}
```

### 5. IPC Handlers

Add to preload or main IPC:

```typescript
// Window management IPC
ipcMain.handle('window:create', async (_, options) => {
  const window = await createWindow(options);
  return window.id;
});

ipcMain.handle('window:close', (_, windowId) => {
  windowManager.closeWindow(windowId);
});

ipcMain.handle('window:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.minimize();
});

ipcMain.handle('window:maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window?.isMaximized()) {
    window.unmaximize();
  } else {
    window?.maximize();
  }
});

ipcMain.handle('window:fullscreen', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.setFullScreen(!window.isFullScreen());
});

ipcMain.handle('window:set-always-on-top', (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.setAlwaysOnTop(enabled);
});

ipcMain.handle('window:get-state', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return null;
  
  return {
    maximized: window.isMaximized(),
    minimized: window.isMinimized(),
    fullscreen: window.isFullScreen(),
    focused: window.isFocused(),
    bounds: window.getBounds(),
  };
});
```

### 6. Window Menu

Create: `7-apps/shell/desktop/main/window/window-menu.ts`

```typescript
export function buildWindowMenu(): MenuItemConstructorOptions {
  return {
    label: 'Window',
    submenu: [
      {
        label: 'New Window',
        accelerator: 'CmdOrCtrl+N',
        click: () => createWindow(),
      },
      { type: 'separator' },
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize',
      },
      {
        label: 'Zoom',
        role: 'zoom',
      },
      {
        label: 'Toggle Full Screen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
        click: (_, window) => {
          window?.setFullScreen(!window.isFullScreen());
        },
      },
      { type: 'separator' },
      {
        label: 'Bring All to Front',
        role: 'front',
      },
      {
        label: 'Close Window',
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      },
    ],
  };
}
```

## Requirements

- Multi-window support
- Window state persistence (position, size, maximized)
- Multi-monitor support
- Window state restoration on launch
- Different window types (main, settings, about, popout)
- IPC for window control

## Success Criteria
- [ ] WindowManager class
- [ ] Window state persistence
- [ ] Multi-window support
- [ ] 4 window types
- [ ] IPC handlers for window control
- [ ] Window menu
- [ ] No SYSTEM_LAW violations
