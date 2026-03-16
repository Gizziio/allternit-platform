import { BrowserWindow, ipcMain, WebContents } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';

export interface WindowMessage {
  sourceWindowId: string;
  targetWindowId: string;
  channel: string;
  payload: unknown;
  timestamp: number;
}

export interface PopOutOptions {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  title?: string;
  alwaysOnTop?: boolean;
  x?: number;
  y?: number;
}

class MultiWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private messageQueue: WindowMessage[] = [];
  private maxQueueSize = 100;
  private windowIdCounter = 0;

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    ipcMain.handle(
      IPC_CHANNELS.MULTI_WINDOW.SEND_MESSAGE,
      (_, targetWindowId: string, channel: string, payload: unknown) => {
        const sourceWindow = BrowserWindow.getFocusedWindow();
        const sourceWindowId = this.getWindowId(sourceWindow);

        return this.sendMessage({
          sourceWindowId: sourceWindowId || 'unknown',
          targetWindowId,
          channel,
          payload,
          timestamp: Date.now(),
        });
      }
    );

    ipcMain.handle(IPC_CHANNELS.MULTI_WINDOW.BROADCAST, (_, channel: string, payload: unknown) => {
      const sourceWindow = BrowserWindow.getFocusedWindow();
      const sourceWindowId = this.getWindowId(sourceWindow);

      this.broadcast(sourceWindowId || 'unknown', channel, payload);
    });

    ipcMain.handle(IPC_CHANNELS.MULTI_WINDOW.GET_WINDOWS, () => {
      return this.getWindowList();
    });

    ipcMain.handle(IPC_CHANNELS.MULTI_WINDOW.FOCUS_WINDOW, (_, windowId: string) => {
      return this.focusWindow(windowId);
    });

    ipcMain.handle(IPC_CHANNELS.MULTI_WINDOW.CLOSE_WINDOW, (_, windowId: string) => {
      return this.closeWindow(windowId);
    });
  }

  registerWindow(windowId: string, window: BrowserWindow): void {
    this.windows.set(windowId, window);

    window.on('closed', () => {
      this.unregisterWindow(windowId);
    });

    this.processMessageQueue();
  }

  unregisterWindow(windowId: string): void {
    this.windows.delete(windowId);
  }

  getWindowId(window: BrowserWindow | null | undefined): string | undefined {
    if (!window) return undefined;

    for (const [id, win] of this.windows) {
      if (win === window) {
        return id;
      }
    }

    return undefined;
  }

  getWindowList(): Array<{ id: string; title: string; isFocused: boolean; isVisible: boolean }> {
    const list: Array<{ id: string; title: string; isFocused: boolean; isVisible: boolean }> = [];
    const focusedWindow = BrowserWindow.getFocusedWindow();

    for (const [id, window] of this.windows) {
      if (!window.isDestroyed()) {
        list.push({
          id,
          title: window.getTitle(),
          isFocused: window === focusedWindow,
          isVisible: window.isVisible(),
        });
      }
    }

    return list;
  }

  sendMessage(message: WindowMessage): boolean {
    const targetWindow = this.windows.get(message.targetWindowId);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send(IPC_CHANNELS.MULTI_WINDOW.MESSAGE_RECEIVED, message);

      if (message.targetWindowId !== message.sourceWindowId) {
        targetWindow.flashFrame(true);
      }

      return true;
    }

    this.queueMessage(message);
    return false;
  }

  broadcast(sourceWindowId: string, channel: string, payload: unknown): void {
    const message: Omit<WindowMessage, 'targetWindowId'> = {
      sourceWindowId,
      channel,
      payload,
      timestamp: Date.now(),
    };

    for (const [targetWindowId, window] of this.windows) {
      if (!window.isDestroyed()) {
        const fullMessage: WindowMessage = {
          ...message,
          targetWindowId,
        };

        window.webContents.send(IPC_CHANNELS.MULTI_WINDOW.MESSAGE_RECEIVED, fullMessage);
      }
    }
  }

  private queueMessage(message: WindowMessage): void {
    this.messageQueue.push(message);

    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }
  }

  private processMessageQueue(): void {
    const unprocessedMessages: WindowMessage[] = [];

    for (const message of this.messageQueue) {
      const delivered = this.sendMessage(message);
      if (!delivered) {
        unprocessedMessages.push(message);
      }
    }

    this.messageQueue = unprocessedMessages;
  }

  focusWindow(windowId: string): boolean {
    const window = this.windows.get(windowId);

    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
      window.show();
      return true;
    }

    return false;
  }

  closeWindow(windowId: string): boolean {
    const window = this.windows.get(windowId);

    if (window && !window.isDestroyed()) {
      window.close();
      return true;
    }

    return false;
  }

  generateWindowId(): string {
    return `window-${++this.windowIdCounter}`;
  }

  createPopOutWindow(
    windowManager: {
      createSecondaryWindow: (route: string, options: PopOutOptions) => BrowserWindow;
    },
    route: string,
    options: PopOutOptions = {}
  ): { windowId: string; window: BrowserWindow } {
    const windowId = this.generateWindowId();

    const window = windowManager.createSecondaryWindow(route, {
      width: options.width || 800,
      height: options.height || 600,
      minWidth: options.minWidth || 400,
      minHeight: options.minHeight || 300,
      title: options.title,
      alwaysOnTop: options.alwaysOnTop,
      x: options.x,
      y: options.y,
    });

    this.registerWindow(windowId, window);

    return { windowId, window };
  }

  createChatPopOut(
    windowManager: {
      createSecondaryWindow: (route: string, options: PopOutOptions) => BrowserWindow;
    },
    chatId: string,
    options: PopOutOptions = {}
  ): { windowId: string; window: BrowserWindow } {
    return this.createPopOutWindow(windowManager, `/chat/${chatId}`, {
      width: options.width || 420,
      height: options.height || 700,
      minWidth: options.minWidth || 320,
      minHeight: options.minHeight || 500,
      title: options.title || 'Chat',
      ...options,
    });
  }

  createPictureInPicture(
    windowManager: {
      createSecondaryWindow: (route: string, options: PopOutOptions) => BrowserWindow;
    },
    options: PopOutOptions = {}
  ): { windowId: string; window: BrowserWindow } {
    const { windowId, window } = this.createPopOutWindow(windowManager, '/pip', {
      width: options.width || 300,
      height: options.height || 300,
      minWidth: options.minWidth || 200,
      minHeight: options.minHeight || 200,
      maxWidth: 500,
      maxHeight: 500,
      title: options.title || 'Orb',
      alwaysOnTop: true,
      ...options,
    });

    window.setAspectRatio(1);
    window.setVisibleOnAllWorkspaces(true);

    return { windowId, window };
  }

  createTerminalWindow(
    windowManager: {
      createSecondaryWindow: (route: string, options: PopOutOptions) => BrowserWindow;
    },
    sessionId: string,
    options: PopOutOptions = {}
  ): { windowId: string; window: BrowserWindow } {
    return this.createPopOutWindow(windowManager, `/terminal/${sessionId}`, {
      width: options.width || 900,
      height: options.height || 550,
      minWidth: options.minWidth || 400,
      minHeight: options.minHeight || 300,
      title: options.title || 'Terminal',
      ...options,
    });
  }

  dispose(): void {
    this.windows.clear();
    this.messageQueue = [];
  }
}

export const multiWindowManager = new MultiWindowManager();

export function setupWindowCommunication(window: BrowserWindow, windowId: string): void {
  multiWindowManager.registerWindow(windowId, window);

  window.webContents.on('did-finish-load', () => {
    window.webContents.send(IPC_CHANNELS.MULTI_WINDOW.WINDOW_READY, {
      windowId,
      isMain: windowId === 'main',
    });
  });
}

export function getMultiWindowManager(): MultiWindowManager {
  return multiWindowManager;
}
