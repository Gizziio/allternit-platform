/**
 * A2R Desktop - Cloud-Connected Edition
 * 
 * Self-hosted architecture: Users run backend on their VPS or locally.
 * Desktop app is the UI that connects to user's personal A2R instance.
 * 
 * Connection Modes:
 * 1. VPS Mode: Connect to user's cloud instance (https://a2r.userdomain.com)
 * 2. Local Mode: Connect to localhost services
 * 3. Discovery Mode: Auto-find running local services
 */

import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Store from 'electron-store';
import log from 'electron-log';
import { updateElectronApp } from 'update-electron-app';
import fixPath from 'fix-path';

// Fix PATH for macOS
fixPath();

// Configure logging
log.initialize();
log.transports.file.level = 'info';

// Auto-updater (for UI only)
updateElectronApp({ logger: log });

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// ============================================================================
// State
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Connection state
interface ConnectionState {
  mode: 'vps' | 'local';
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError?: string;
}

// ============================================================================
// Store
// ============================================================================

interface StoreSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number };
  theme: 'light' | 'dark' | 'system';
  backend: {
    mode: 'vps' | 'local';
    vpsUrl: string;
    localPort: number;
  };
  auth: {
    token?: string;
    userId?: string;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    theme: 'system',
    backend: {
      mode: 'local',
      vpsUrl: '',
      localPort: 4096,
    },
    auth: {},
  },
});

// ============================================================================
// Backend Connection Management
// ============================================================================

async function checkBackendHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function discoverLocalBackend(): Promise<string | null> {
  const ports = [4096, 3000, 8080, 8013];
  
  for (const port of ports) {
    const url = `http://localhost:${port}`;
    if (await checkBackendHealth(url)) {
      return url;
    }
  }
  
  return null;
}

async function getBackendUrl(): Promise<string> {
  const backend = store.get('backend');
  
  if (backend.mode === 'vps' && backend.vpsUrl) {
    return backend.vpsUrl;
  }
  
  // Try to discover local backend
  const localUrl = await discoverLocalBackend();
  if (localUrl) {
    return localUrl;
  }
  
  // Fallback to configured local port
  return `http://localhost:${backend.localPort}`;
}

async function testConnection(): Promise<ConnectionState> {
  const backend = store.get('backend');
  const url = await getBackendUrl();
  
  const isHealthy = await checkBackendHealth(url);
  
  return {
    mode: backend.mode,
    url,
    status: isHealthy ? 'connected' : 'disconnected',
  };
}

// ============================================================================
// Window
// ============================================================================

function createWindow(): void {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 768,
    title: 'A2R Desktop',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Load the connection setup or main app
  loadApp();

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const saveBounds = () => {
    if (mainWindow) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('closed', () => mainWindow = null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function loadApp(): Promise<void> {
  if (!mainWindow) return;

  // Check backend connection
  const conn = await testConnection();
  
  if (isDev) {
    // Development mode
    if (conn.status === 'connected') {
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      // Show connection setup in dev
      mainWindow.loadFile(join(__dirname, '../renderer/connect.html'));
    }
  } else {
    // Production mode
    if (conn.status === 'connected') {
      // Load bundled platform UI with backend URL injected
      mainWindow.loadFile(join(__dirname, '../../renderer/platform/index.html'));
    } else {
      // Show connection setup
      mainWindow.loadFile(join(__dirname, '../../renderer/connect.html'));
    }
  }

  // Send connection info to renderer
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow?.webContents.send('connection:state', conn);
  });
}

// ============================================================================
// Tray
// ============================================================================

function createTray(): void {
  const iconPath = join(__dirname, '../../build/tray-icon.png');
  if (!require('fs').existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('A2R Desktop');
  updateTrayMenu();
}

async function updateTrayMenu(): Promise<void> {
  if (!tray) return;

  const conn = await testConnection();
  const backend = store.get('backend');

  const statusIcon = {
    connected: '🟢',
    connecting: '🟡',
    disconnected: '🔴',
    error: '⚠️',
  }[conn.status];

  const contextMenu = Menu.buildFromTemplate([
    { label: 'A2R Desktop', enabled: false },
    { type: 'separator' },
    { 
      label: `${statusIcon} ${conn.status.toUpperCase()}`, 
      enabled: false 
    },
    { 
      label: `Backend: ${backend.mode === 'vps' ? 'VPS' : 'Local'}`,
      enabled: false,
    },
    { type: 'separator' },
    { 
      label: 'Connection Settings...', 
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send('navigate', '/connect');
      }
    },
    { 
      label: 'Test Connection', 
      click: async () => {
        const result = await testConnection();
        dialog.showMessageBox(mainWindow!, {
          type: result.status === 'connected' ? 'info' : 'warning',
          title: 'Connection Test',
          message: result.status === 'connected' 
            ? `Connected to ${result.url}` 
            : `Failed to connect to ${result.url}`,
        });
      }
    },
    { type: 'separator' },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ] as any);

  tray.setContextMenu(contextMenu);
}

// ============================================================================
// App Lifecycle
// ============================================================================

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });

  // Refresh tray menu periodically
  setInterval(updateTrayMenu, 10000);
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

// ============================================================================
// IPC Handlers
// ============================================================================

// Connection management
ipcMain.handle('connection:test', testConnection);

ipcMain.handle('connection:get-backend', () => store.get('backend'));

ipcMain.handle('connection:set-backend', (_event, config: StoreSchema['backend']) => {
  store.set('backend', config);
  return testConnection();
});

ipcMain.handle('connection:discover', discoverLocalBackend);

// Store
ipcMain.handle('store:get', (_event, key: keyof StoreSchema) => store.get(key));
ipcMain.handle('store:set', (_event, key: keyof StoreSchema, value: unknown) => {
  store.set(key, value);
});

// App info
ipcMain.handle('app:get-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isPackaged: app.isPackaged,
}));

// Shell
ipcMain.handle('shell:open-external', (_event, url: string) => {
  shell.openExternal(url);
});

// Dialog
ipcMain.handle('dialog:show-save', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('dialog:show-open', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showOpenDialog(mainWindow, options);
});
