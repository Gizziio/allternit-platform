import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { createWindowOptions, saveWindowState, restoreWindowState } from './window-state';
import { setupWindowEvents } from './window-events';
import { WindowPool } from './window-pool';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const gotTheLock = app.requestSingleInstanceLock();

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private windowPool: WindowPool;
  private secondaryWindows: Map<string, BrowserWindow> = new Map();
  private windowIdCounter = 0;
  private isQuitting = false;
  private preloadPath: string;
  private indexPath: string;

  constructor(preloadPath: string, indexPath: string) {
    this.preloadPath = preloadPath;
    this.indexPath = indexPath;
    this.windowPool = new WindowPool(preloadPath, indexPath);

    this.setupSingleInstance();
    this.setupThemeHandler();
  }

  private setupSingleInstance(): void {
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      this.focusMainWindow();
    });
  }

  private setupThemeHandler(): void {
    ipcMain.handle(IPC_CHANNELS.THEME.GET, () => {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    ipcMain.handle(IPC_CHANNELS.THEME.SET, (_, theme: 'light' | 'dark' | 'system') => {
      nativeTheme.themeSource = theme;
    });

    nativeTheme.on('updated', () => {
      this.broadcastToAllWindows(IPC_CHANNELS.THEME.UPDATED, nativeTheme.shouldUseDarkColors);
    });
  }

  createMainWindow(): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    const options = createWindowOptions();
    options.preload = this.preloadPath;

    this.mainWindow = new BrowserWindow(options);

    this.mainWindow.loadFile(this.indexPath);

    setupWindowEvents(this.mainWindow, (quitting) => {
      this.isQuitting = quitting;
    });

    this.mainWindow.once('ready-to-show', () => {
      restoreWindowState(this.mainWindow!);
      this.mainWindow!.show();

      if (process.env.NODE_ENV === 'development') {
        this.mainWindow!.webContents.openDevTools();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      if (!this.isQuitting) {
        this.windowPool.dispose();
        this.closeAllSecondaryWindows();
      }
    });

    this.setupWindowControls();

    return this.mainWindow;
  }

  private setupWindowControls(): void {
    ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, () => {
      this.mainWindow?.close();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW.IS_MAXIMIZED, () => {
      return this.mainWindow?.isMaximized() ?? false;
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW.GET_BOUNDS, () => {
      return this.mainWindow?.getBounds();
    });
  }

  focusMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.focus();
      this.mainWindow.show();
    } else {
      this.createMainWindow();
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  createSecondaryWindow(
    route: string,
    options: Partial<Electron.BrowserWindowConstructorOptions> = {}
  ): BrowserWindow {
    const windowId = `window-${++this.windowIdCounter}`;

    const window = this.windowPool.acquire({
      ...options,
      title: options.title || 'Allternit',
    });

    if (route) {
      const url = `${this.indexPath}#${route}`;
      window.loadURL(url);
    } else {
      window.loadFile(this.indexPath);
    }

    this.secondaryWindows.set(windowId, window);

    window.on('closed', () => {
      this.secondaryWindows.delete(windowId);
      this.windowPool.release(window);
    });

    window.once('ready-to-show', () => {
      window.show();
    });

    return window;
  }

  createPopOutChat(chatId: string): BrowserWindow {
    return this.createSecondaryWindow(`/chat/${chatId}`, {
      width: 400,
      height: 600,
      minWidth: 320,
      minHeight: 400,
      title: 'Chat',
    });
  }

  createPictureInPicture(): BrowserWindow {
    const window = this.createSecondaryWindow('/pip', {
      width: 320,
      height: 320,
      minWidth: 200,
      minHeight: 200,
      maxWidth: 600,
      maxHeight: 600,
      title: 'Orb',
      alwaysOnTop: true,
      resizable: true,
    });

    window.setAspectRatio(1);

    return window;
  }

  createDetachedTerminal(sessionId: string): BrowserWindow {
    return this.createSecondaryWindow(`/terminal/${sessionId}`, {
      width: 800,
      height: 500,
      minWidth: 400,
      minHeight: 300,
      title: 'Terminal',
    });
  }

  closeSecondaryWindow(windowId: string): boolean {
    const window = this.secondaryWindows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.close();
      return true;
    }
    return false;
  }

  closeAllSecondaryWindows(): void {
    for (const [id, window] of this.secondaryWindows) {
      if (!window.isDestroyed()) {
        window.removeAllListeners('closed');
        window.close();
      }
    }
    this.secondaryWindows.clear();
  }

  getSecondaryWindows(): Map<string, BrowserWindow> {
    return new Map(this.secondaryWindows);
  }

  broadcastToAllWindows(channel: string, ...args: unknown[]): void {
    this.mainWindow?.webContents.send(channel, ...args);

    for (const window of this.secondaryWindows.values()) {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, ...args);
      }
    }
  }

  sendToWindow(windowId: string, channel: string, ...args: unknown[]): boolean {
    if (windowId === 'main') {
      this.mainWindow?.webContents.send(channel, ...args);
      return true;
    }

    const window = this.secondaryWindows.get(windowId);
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, ...args);
      return true;
    }

    return false;
  }

  prepareForQuit(): void {
    this.isQuitting = true;

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      saveWindowState(this.mainWindow);
    }

    this.closeAllSecondaryWindows();
    this.windowPool.dispose();
  }

  shouldPreventClose(): boolean {
    if (this.isQuitting) {
      return false;
    }

    return false;
  }

  minimizeToTray(): void {
    this.mainWindow?.hide();
  }

  restoreFromTray(): void {
    this.focusMainWindow();
  }
}

let windowManagerInstance: WindowManager | null = null;

export function initializeWindowManager(
  preloadPath: string,
  indexPath: string
): WindowManager {
  if (!windowManagerInstance) {
    windowManagerInstance = new WindowManager(preloadPath, indexPath);
  }
  return windowManagerInstance;
}

export function getWindowManager(): WindowManager | null {
  return windowManagerInstance;
}

export function setIsQuitting(value: boolean): void {
  if (windowManagerInstance) {
    (windowManagerInstance as unknown as { isQuitting: boolean }).isQuitting = value;
  }
}
