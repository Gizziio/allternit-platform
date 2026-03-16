/**
 * A2R Desktop - Unified Main Process
 * 
 * Unified architecture: Desktop is the control plane.
 * - Manages local backend (bundled, auto-extracted)
 * - Connects to remote backend (VPS)
 * - Version-locked: Desktop 1.2.3 = Backend 1.2.3
 */

import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Store from 'electron-store';
import log from 'electron-log';
import { updateElectronApp } from 'update-electron-app';
import fixPath from 'fix-path';
import { backendManager } from './backend-manager';
import { PLATFORM_MANIFEST, shouldUpdateBackend } from './manifest';

// Fix PATH for macOS
fixPath();

// Configure logging
log.initialize();
log.transports.file.level = 'info';

// Auto-updater
updateElectronApp({ logger: log });

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

// ============================================================================
// State
// ============================================================================

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
/** Resolved backend URL — set once the app initializes. Used by sdk:get-backend-url IPC. */
let activeBackendUrl: string = 'http://localhost:4096';

interface StoreSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number };
  theme: 'light' | 'dark' | 'system';
  backend: {
    mode: 'bundled' | 'remote' | 'development';
    remoteUrl?: string;
    lastLocalVersion?: string;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    theme: 'system',
    backend: {
      mode: 'bundled',
    },
  },
});

// ============================================================================
// Splash Window (First-run / Loading)
// ============================================================================

function createSplashWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Inline splash HTML
  const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      border-radius: 12px;
    }
    .logo { font-size: 56px; font-weight: 800; margin-bottom: 8px; letter-spacing: -2px; }
    .tagline { font-size: 14px; opacity: 0.9; margin-bottom: 40px; }
    .status { font-size: 15px; margin-bottom: 20px; text-align: center; min-height: 22px; }
    .progress-container {
      width: 100%; height: 4px; background: rgba(255,255,255,0.2);
      border-radius: 2px; overflow: hidden; margin-bottom: 12px;
    }
    .progress-bar { height: 100%; background: white; border-radius: 2px; transition: width 0.3s ease; width: 0%; }
    .progress-text { font-size: 12px; opacity: 0.8; }
    .version { position: absolute; bottom: 16px; right: 20px; font-size: 11px; opacity: 0.6; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="logo">A2R</div>
  <div class="tagline">AI Runtime Platform</div>
  
  <div id="loading">
    <div class="spinner"></div>
    <div class="status" id="status">Starting...</div>
    <div class="progress-container">
      <div class="progress-bar" id="progress-bar"></div>
    </div>
    <div class="progress-text" id="progress-text"></div>
  </div>
  
  <div class="version">v${PLATFORM_MANIFEST.version}</div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.on('status', (_, message) => {
      document.getElementById('status').textContent = message;
    });
    
    ipcRenderer.on('progress', (_, percent) => {
      document.getElementById('progress-bar').style.width = percent + '%';
      document.getElementById('progress-text').textContent = percent > 0 ? percent + '%' : '';
    });
    
    ipcRenderer.on('complete', () => {
      document.getElementById('loading').innerHTML = 
        '<div style="font-size: 32px; margin-bottom: 8px;">✓</div><div>Ready</div>';
    });
    
    ipcRenderer.on('error', (_, message) => {
      document.getElementById('status').textContent = 'Error: ' + message;
      document.getElementById('status').style.color = '#fecaca';
    });
  </script>
</body>
</html>`;

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  return window;
}

// ============================================================================
// Main Window
// ============================================================================

function createMainWindow(): BrowserWindow {
  const bounds = store.get('windowBounds');

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 768,
    title: 'A2R Platform',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    show: false, // Don't show until loaded
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const saveBounds = () => {
    if (window) {
      store.set('windowBounds', window.getBounds());
    }
  };

  window.on('resize', saveBounds);
  window.on('move', saveBounds);
  window.on('closed', () => mainWindow = null);

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return window;
}

// ============================================================================
// App Initialization (Unified Flow)
// ============================================================================

async function initializeApp(): Promise<void> {
  log.info('[Main] Initializing A2R Desktop v' + PLATFORM_MANIFEST.version);
  
  const backendConfig = store.get('backend');
  
  // Determine which mode to use
  if (backendConfig.mode === 'development') {
    // Development mode - connect to localhost:4096
    await initializeDevelopmentMode();
  } else if (backendConfig.mode === 'remote' && backendConfig.remoteUrl) {
    // Remote mode - connect to user VPS
    await initializeRemoteMode(backendConfig.remoteUrl);
  } else {
    // Bundled mode - manage local backend
    await initializeBundledMode();
  }
}

async function initializeBundledMode(): Promise<void> {
  log.info('[Main] Bundled mode - managing local backend');
  
  // Show splash
  splashWindow = createSplashWindow();
  const updateSplash = (status: string, progress?: number) => {
    splashWindow?.webContents.send('status', status);
    if (progress !== undefined) {
      splashWindow?.webContents.send('progress', progress);
    }
  };
  
  try {
    // Check current backend status
    const status = await backendManager.getStatus();
    
    if (status.running) {
      // Already running - check version
      if (status.version && shouldUpdateBackend(status.version)) {
        updateSplash('Updating A2R Backend...', 50);
        // Backend manager will handle update
      } else {
        updateSplash('Connecting...', 100);
      }
    } else if (!status.installed) {
      // First run - extract backend
      updateSplash('Setting up A2R for the first time...', 10);
    } else {
      updateSplash('Starting A2R Backend...', 50);
    }
    
    // Ensure backend is ready
    const backendUrl = await backendManager.ensureBackend();
    activeBackendUrl = backendUrl;

    // Update stored version
    store.set('backend.lastLocalVersion', PLATFORM_MANIFEST.backend.version);
    
    // Complete
    splashWindow?.webContents.send('complete');
    await new Promise(r => setTimeout(r, 500)); // Show checkmark briefly
    
    // Close splash, open main
    splashWindow?.close();
    splashWindow = null;
    
    mainWindow = createMainWindow();
    
    // Load from local backend
    if (isDev) {
      mainWindow.loadURL('http://localhost:3000');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadURL(`${backendUrl}/platform`);
    }
    
    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });
    
  } catch (error) {
    log.error('[Main] Failed to initialize bundled mode:', error);
    splashWindow?.webContents.send('error', (error as Error).message);
    
    dialog.showErrorBox(
      'A2R Initialization Error',
      `Failed to start A2R Backend:\n${(error as Error).message}\n\nPlease try again or contact support.`
    );
    
    app.quit();
  }
}

async function initializeRemoteMode(remoteUrl: string): Promise<void> {
  log.info('[Main] Remote mode - connecting to', remoteUrl);
  
  // Check connection
  try {
    const response = await fetch(`${remoteUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error('Backend not responding');
    }
    
    // Check version compatibility
    const versionResponse = await fetch(`${remoteUrl}/version`);
    const { version } = await versionResponse.json();
    
    if (shouldUpdateBackend(version)) {
      // Show update dialog
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Backend Update Required',
        message: `Your VPS backend (${version}) needs to be updated to ${PLATFORM_MANIFEST.backend.version}.`,
        buttons: ['Update Now', 'Continue Anyway', 'Switch to Local'],
        defaultId: 0,
      });
      
      if (result.response === 0) {
        // Update remote backend (SSH into VPS)
        // This would need SSH credentials stored securely
        log.info('[Main] Would update remote backend via SSH');
      } else if (result.response === 2) {
        // Switch to local mode
        store.set('backend.mode', 'bundled');
        await initializeBundledMode();
        return;
      }
    }
    
    // Track the resolved URL for SDK consumers
    activeBackendUrl = remoteUrl;

    // Open main window
    mainWindow = createMainWindow();
    mainWindow.loadURL(`${remoteUrl}/platform`);
    mainWindow.show();
    
  } catch (error) {
    log.error('[Main] Remote connection failed:', error);
    
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Connection Failed',
      message: `Cannot connect to A2R Backend at ${remoteUrl}.`,
      buttons: ['Try Again', 'Switch to Local Mode', 'Quit'],
      defaultId: 0,
    });
    
    if (result.response === 0) {
      await initializeRemoteMode(remoteUrl);
    } else if (result.response === 1) {
      store.set('backend.mode', 'bundled');
      await initializeBundledMode();
    } else {
      app.quit();
    }
  }
}

async function initializeDevelopmentMode(): Promise<void> {
  log.info('[Main] Development mode');
  activeBackendUrl = 'http://localhost:3000';

  mainWindow = createMainWindow();
  mainWindow.loadURL('http://localhost:3000');
  mainWindow.webContents.openDevTools();
  mainWindow.show();
}

// ============================================================================
// Tray
// ============================================================================

function createTray(): void {
  // Tray icon path
  const iconPath = join(__dirname, '../../build/tray-icon.png');
  if (!require('fs').existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('A2R Platform');
  updateTrayMenu();
}

async function updateTrayMenu(): Promise<void> {
  if (!tray) return;

  const backend = store.get('backend');
  const status = await backendManager.getStatus();
  
  const statusIcon = status.running ? '🟢' : '🔴';
  const modeLabel = backend.mode === 'bundled' ? 'Local' : 
                    backend.mode === 'remote' ? 'VPS' : 'Dev';

  const contextMenu = Menu.buildFromTemplate([
    { label: 'A2R Platform', enabled: false },
    { type: 'separator' },
    { label: `${statusIcon} ${status.running ? 'Running' : 'Stopped'}`, enabled: false },
    { label: `Mode: ${modeLabel}`, enabled: false },
    { type: 'separator' },
    { 
      label: 'Connection Settings...', 
      click: () => {
        mainWindow?.show();
        // Navigate to settings
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
  initializeApp();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initializeApp();
    } else {
      mainWindow?.show();
    }
  });
  
  // Refresh tray every 10s
  setInterval(updateTrayMenu, 10000);
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});

app.on('before-quit', async () => {
  // Stop local backend on quit
  await backendManager.stopBackend();
});

// ============================================================================
// IPC Handlers
// ============================================================================

// SDK — exposes the resolved backend URL so the renderer can init createA2RClient()
ipcMain.handle('sdk:get-backend-url', () => activeBackendUrl);

// Backend management
ipcMain.handle('backend:get-status', () => backendManager.getStatus());
ipcMain.handle('backend:restart', async () => {
  await backendManager.stopBackend();
  return backendManager.ensureBackend();
});

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
  manifest: PLATFORM_MANIFEST,
}));

// Shell
ipcMain.handle('shell:open-external', (_event, url: string) => {
  shell.openExternal(url);
});
