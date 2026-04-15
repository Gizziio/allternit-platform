/**
 * Allternit Desktop — Unified Main Process
 * 
 * Unified architecture: Desktop is the control plane.
 * - Manages local backend (bundled, auto-extracted)
 * - Connects to remote backend (VPS)
 * - Version-locked: Desktop 1.2.3 = Backend 1.2.3
 */

import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import Store from 'electron-store';
import log from 'electron-log';
import { updateElectronApp } from 'update-electron-app';
import fixPath from 'fix-path';
import { backendManager } from './backend-manager.js';
import { gizziManager } from './gizzi-manager.js';
import { platformServerManager } from './platform-server.js';
import { tunnelManager } from './tunnel-manager.js';
import { PLATFORM_MANIFEST, shouldUpdateBackend } from './manifest.js';

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
let activeBackendUrl: string = 'http://localhost:8013';
/** Active TCP connection from the native messaging host (Chrome extension bridge) */
let extensionSocket: net.Socket | null = null;

interface StoreSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number };
  theme: 'light' | 'dark' | 'system';
  backend: {
    mode: 'bundled' | 'remote' | 'development';
    remoteUrl?: string;
    lastLocalVersion?: string;
  };
  onboardingComplete: boolean;
}

const store = new Store<StoreSchema>({
  defaults: {
    windowBounds: { width: 1400, height: 900 },
    theme: 'system',
    backend: {
      mode: 'bundled',
    },
    onboardingComplete: false,
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

  // Inline splash HTML - Allternit branded
  const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1512 50%, #12121a 100%);
      color: #D4B08C;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      border-radius: 12px;
      border: 1px solid rgba(212, 176, 140, 0.2);
    }
    .mascot {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.2;
      white-space: pre;
      color: #D4B08C;
      margin-bottom: 20px;
      text-align: center;
    }
    .brand {
      font-size: 32px;
      font-weight: 700;
      color: #D4B08C;
      font-family: Georgia, 'Times New Roman', serif;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .tagline {
      font-size: 13px;
      color: #9B9B9B;
      margin-bottom: 40px;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    .status {
      font-size: 14px;
      margin-bottom: 20px;
      text-align: center;
      min-height: 22px;
      color: #a0a0b0;
    }
    .progress-container {
      width: 100%; height: 3px;
      background: rgba(212, 176, 140, 0.15);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #D4B08C, #E8997A);
      border-radius: 2px;
      transition: width 0.3s ease;
      width: 0%;
    }
    .progress-text {
      font-size: 11px;
      color: #8f6f56;
    }
    .version {
      position: absolute;
      bottom: 16px;
      right: 20px;
      font-size: 11px;
      color: #6B6B6B;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(212, 176, 140, 0.2);
      border-top-color: #D4B08C;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .logo-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 20px;
      height: 60px;
    }
    .matrix-a {
      position: relative;
      width: 60px;
      height: 50px;
      transform-style: preserve-3d;
      perspective: 600px;
    }
    .block {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #D4B08C;
      left: calc(50% + var(--x) * 10px - 4px);
      top: calc(50% + var(--y) * 10px - 4px);
      transform: translateZ(calc(var(--z) * 0.5px));
      opacity: 0.9;
      animation: pulse 2s ease-in-out infinite;
      animation-delay: calc(var(--z) * 0.05s);
    }
    .block.center {
      background: #E8997A;
      box-shadow: 0 0 10px #D4B08C;
    }
    .block.crossbar {
      opacity: 0.7;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.7; transform: translateZ(calc(var(--z) * 0.5px)) scale(1); }
      50% { opacity: 1; transform: translateZ(calc(var(--z) * 0.8px)) scale(1.1); }
    }
  </style>
</head>
<body>
  <div class="logo-container">
    <div class="matrix-a">
      <div class="block" style="--x:-2;--y:2;--z:20"></div>
      <div class="block" style="--x:-2;--y:1;--z:10"></div>
      <div class="block" style="--x:-2;--y:0;--z:0"></div>
      <div class="block" style="--x:-1;--y:-1;--z:15"></div>
      <div class="block center" style="--x:0;--y:-2;--z:30"></div>
      <div class="block" style="--x:1;--y:-1;--z:15"></div>
      <div class="block" style="--x:2;--y:0;--z:0"></div>
      <div class="block" style="--x:2;--y:1;--z:10"></div>
      <div class="block" style="--x:2;--y:2;--z:20"></div>
      <div class="block crossbar" style="--x:-1;--y:0;--z:5"></div>
      <div class="block crossbar" style="--x:1;--y:0;--z:5"></div>
    </div>
  </div>
  <div class="brand">ALLTERNIT</div>
  <div class="tagline">Desktop</div>
  
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
        '<div style="font-size: 24px; margin-bottom: 8px; color: #D4B08C;">✓</div><div style="color: #D4B08C;">Ready</div>';
    });
    
    ipcRenderer.on('error', (_, message) => {
      document.getElementById('status').textContent = 'Error: ' + message;
      document.getElementById('status').style.color = '#E57373';
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
  let bounds = store.get('windowBounds');
  
  // Ensure bounds are valid - if not, use defaults
  if (!bounds || !bounds.width || !bounds.height || bounds.width < 100 || bounds.height < 100) {
    bounds = { width: 1400, height: 900 };
  }
  
  log.info(`[Main] Creating window with bounds:`, bounds);

  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 768,
    title: 'Allternit',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    show: true, // Show immediately
    backgroundColor: '#0F0C0A', // Match the app's dark background
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const saveBounds = () => {
    if (window && !window.isDestroyed()) {
      store.set('windowBounds', window.getBounds());
    }
  };

  window.on('resize', saveBounds);
  window.on('move', saveBounds);
  window.on('closed', () => mainWindow = null);
  
  // Ensure window is visible and focused
  window.once('ready-to-show', () => {
    log.info('[Main] ready-to-show event fired');
    window.show();
    window.focus();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto-open DevTools for debugging
  window.webContents.openDevTools({ mode: 'detach' });
  
  // Log console messages
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log.info(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  return window;
}

// ============================================================================
// App Initialization (Unified Flow)
// ============================================================================

async function initializeApp(): Promise<void> {
  log.info('[Main] Initializing Allternit Desktop v' + PLATFORM_MANIFEST.version);
  
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
    log.info('[Main] Starting initialization sequence...');
    // Step 1 — gizzi-code (AI runtime, port 4096)
    // All agent sessions, conversations, tool calls and provider routing go through here.
    updateSplash('Starting AI runtime…', 10);
    let gizziUrl: string | null = null;
    try {
      gizziUrl = await gizziManager.start();
      activeBackendUrl = gizziUrl;
      log.info('[Main] Gizzi-code started successfully');
    } catch (gizziErr) {
      log.warn('[Main] Gizzi-code failed to start, continuing without AI runtime:', gizziErr);
      updateSplash('AI runtime unavailable, continuing…', 15);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Step 2 — allternit-api (Rust operator API, port 8013 — VM, rails, terminal)
    const apiStatus = await backendManager.getStatus();
    if (!apiStatus.installed) {
      updateSplash('Setting up Allternit for the first time…', 25);
    } else if (apiStatus.version && shouldUpdateBackend(apiStatus.version)) {
      updateSplash('Updating Allternit…', 25);
    } else {
      updateSplash('Starting operator backend…', 30);
    }

    const apiUrl = await backendManager.ensureBackend();
    store.set('backend.lastLocalVersion', PLATFORM_MANIFEST.backend.version);

    updateSplash('Starting platform UI…', 60);

    // Step 3 — Next.js standalone platform server
    // In dev, the Next.js dev server runs separately on port 3000.
    // In production, the standalone server is bundled in resources/platform-server/.
    let platformUrl: string;
    if (isDev) {
      platformUrl = 'http://localhost:3000';
    } else {
      platformUrl = await platformServerManager.start({
        apiUrl,
        // API key generated per-session by backendManager
        apiKey: backendManager.getApiKey() ?? '',
        // gizzi-code credentials — password generated per-session by gizziManager
        gizziUrl: gizziUrl ?? '',
        gizziPassword: gizziManager.getPassword() ?? '',
      });
      log.info(`[Main] Platform server returned URL: ${platformUrl}`);
    }

    // Complete
    splashWindow?.webContents.send('complete');
    await new Promise(r => setTimeout(r, 400));

    splashWindow?.close();
    splashWindow = null;

    mainWindow = createMainWindow();

    // First launch: tell the platform to show onboarding
    const isFirstLaunch = !store.get('onboardingComplete');
    const loadUrl = isFirstLaunch ? `${platformUrl}?onboarding=1` : platformUrl;
    
    log.info(`[Main] Loading platform URL: ${loadUrl}`);
    
    // Log loading events for debugging
    mainWindow.webContents.on('did-start-loading', () => {
      log.info('[Main] Window started loading');
    });
    mainWindow.webContents.on('did-finish-load', () => {
      log.info('[Main] Window finished loading');
      mainWindow?.show();
    });
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      log.error(`[Main] Window failed to load: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    });
    mainWindow.webContents.on('dom-ready', () => {
      log.info('[Main] DOM ready');
    });
    
    mainWindow.loadURL(loadUrl);

    // Always open DevTools for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    // Push tunnel state changes to the renderer
    tunnelManager.onStatusChange((state) => {
      mainWindow?.webContents.send('tunnel:state', state);
    });

    // Fallback: show window after a timeout even if ready-to-show doesn't fire
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        log.info('[Main] Showing window via timeout fallback');
        mainWindow.show();
      }
    }, 3000);

    // ── First-launch: auto-enable web access ──────────────────────────────────
    // On first install, automatically start the tunnel and open the browser to
    // /connect so the user's browser is connected with zero extra steps.
    // We show one disclosure dialog before doing so.
    if (isFirstLaunch) {
      mainWindow.webContents.once('did-finish-load', async () => {
        // Small delay so the onboarding wizard has time to render
        await new Promise(r => setTimeout(r, 2500));

        const result = await dialog.showMessageBox(mainWindow!, {
          type: 'info',
          title: 'Enable Web Access',
          message: 'Connect from any browser',
          detail:
            'Allternit will create a secure, encrypted tunnel so you can use ' +
            'Allternit from any browser — not just this app.\n\n' +
            'The tunnel is unique to this session and stops when you quit.',
          buttons: ['Enable Web Access', 'Skip for now'],
          defaultId: 0,
          cancelId: 1,
          icon: undefined,
        });

        if (result.response === 0) {
          try {
            // enableWebAccess starts the tunnel and opens the browser to /connect
            await tunnelManager.enableWebAccess();
          } catch (err) {
            log.warn('[Main] Auto-enable web access failed:', err);
          }
        }
      });
    }
    
  } catch (error) {
    log.error('[Main] Failed to initialize bundled mode:', error);
    splashWindow?.webContents.send('error', (error as Error).message);
    
    dialog.showErrorBox(
      'Allternit Initialization Error',
      `Failed to start Allternit Backend:\n${(error as Error).message}\n\nPlease try again or contact support.`
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
    const versionData = await versionResponse.json() as { version: string };
    const version = versionData.version;
    
    if (shouldUpdateBackend(version)) {
      // Show update dialog
      const result = await dialog.showMessageBox({
        type: 'info',
        title: 'Allternit Backend Update Required',
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
      message: `Cannot connect to Allternit Backend at ${remoteUrl}.`,
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
// Extension Bridge — TCP server for native messaging host
// The Chrome extension connects via chrome.runtime.connectNative('com.allternit.desktop').
// Chrome spawns native-host/native-host as a child process; it then connects back
// here over TCP on port 3011 to relay messages bidirectionally.
// ============================================================================

const EXTENSION_BRIDGE_PORT = 3011;

function startExtensionBridge(): void {
  const server = net.createServer((socket) => {
    log.info('[ExtensionBridge] Native host connected');
    extensionSocket = socket;

    // Notify renderer that extension is now connected
    mainWindow?.webContents.send('extension:status', { connected: true });

    let buffer = '';
    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const message = JSON.parse(line);
          mainWindow?.webContents.send('extension:message', message);
        } catch {
          log.warn('[ExtensionBridge] Unparseable message from native host:', line.slice(0, 100));
        }
      }
    });

    socket.on('close', () => {
      log.info('[ExtensionBridge] Native host disconnected');
      extensionSocket = null;
      mainWindow?.webContents.send('extension:status', { connected: false });
    });

    socket.on('error', (err) => {
      log.warn('[ExtensionBridge] Socket error:', err.message);
    });
  });

  server.listen(EXTENSION_BRIDGE_PORT, '127.0.0.1', () => {
    log.info(`[ExtensionBridge] Listening on port ${EXTENSION_BRIDGE_PORT}`);
  });

  server.on('error', (err) => {
    log.warn('[ExtensionBridge] Server error (native host may not be registered):', err.message);
  });
}

// ============================================================================
// Tray
// ============================================================================

function createTray(): void {
  // Tray icon path
  const iconPath = join(__dirname, '../../build/tray-icon.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('Allternit');
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
    { label: 'Allternit', enabled: false },
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
  startExtensionBridge();

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
  tunnelManager.stop();
  await backendManager.stopBackend();
  platformServerManager.stop();
  gizziManager.stop();
});

// ============================================================================
// IPC Handlers
// ============================================================================

// SDK — exposes the resolved backend URL so the renderer can init createAllternitClient()
ipcMain.handle('sdk:get-backend-url', () => activeBackendUrl);

// Backend management
ipcMain.handle('backend:get-status', () => backendManager.getStatus());
ipcMain.handle('backend:restart', async () => {
  await backendManager.stopBackend();
  platformServerManager.stop();
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

// ============================================================================
// IPC: Window Controls
// ============================================================================

ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return { maximized: false };
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return { maximized: false };
  }
  mainWindow.maximize();
  return { maximized: true };
});

ipcMain.handle('window:close', () => { mainWindow?.close(); });

ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('window:fullscreen', (_event, enabled?: boolean) => {
  if (!mainWindow) return { fullscreen: false };
  const next = enabled !== undefined ? enabled : !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return { fullscreen: next };
});

ipcMain.handle('window:set-always-on-top', (_event, enabled: boolean) => {
  mainWindow?.setAlwaysOnTop(enabled);
});

ipcMain.handle('window:get-state', () => {
  if (!mainWindow) return null;
  return {
    maximized: mainWindow.isMaximized(),
    minimized: mainWindow.isMinimized(),
    fullscreen: mainWindow.isFullScreen(),
    focused: mainWindow.isFocused(),
    bounds: mainWindow.getBounds(),
  };
});

ipcMain.handle('window:get-bounds', () => mainWindow?.getBounds());

ipcMain.handle('window:set-bounds', (_event, bounds: Partial<{ x: number; y: number; width: number; height: number }>) => {
  if (mainWindow && bounds) {
    mainWindow.setBounds({ ...mainWindow.getBounds(), ...bounds });
  }
});

ipcMain.handle('window:center', () => { mainWindow?.center(); });
ipcMain.handle('window:hide', () => { mainWindow?.hide(); });
ipcMain.handle('window:show', () => { mainWindow?.show(); });
ipcMain.handle('window:minimize-to-tray', () => { mainWindow?.hide(); });

// ============================================================================
// IPC: Theme
// ============================================================================

ipcMain.handle('theme:get', () =>
  nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
);

ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme;
  store.set('theme', theme);
});

// Push theme changes to all renderer windows
nativeTheme.on('updated', () => {
  const isDark = nativeTheme.shouldUseDarkColors;
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send('theme:updated', isDark);
  });
});

// ============================================================================
// IPC: Dialogs
// ============================================================================

ipcMain.handle('dialog:show-save', async (_event, options: Electron.SaveDialogOptions) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { canceled: true };
  return dialog.showSaveDialog(win, options ?? {});
});

ipcMain.handle('dialog:show-open', async (_event, options: Electron.OpenDialogOptions) => {
  const win = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!win) return { canceled: true, filePaths: [] };
  return dialog.showOpenDialog(win, options ?? {});
});

// ============================================================================
// IPC: Sidecar — gizzi-code AI runtime (port 4096)
// The platform uses window.allternitSidecar to discover the backend URL.
// ============================================================================

ipcMain.handle('sidecar:get-status', async (): Promise<'running' | 'stopped' | 'error'> => {
  if (!gizziManager.isRunning()) return 'stopped';
  try {
    const res = await fetch(`${gizziManager.getUrl()}/api/app/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return res.ok || res.status === 401 || res.status === 404 ? 'running' : 'error';
  } catch {
    return 'error';
  }
});

ipcMain.handle('sidecar:get-api-url', () => gizziManager.getUrl());

ipcMain.handle('sidecar:get-auth-password', () => gizziManager.getPassword());

ipcMain.handle('sidecar:get-basic-auth', () => {
  const password = gizziManager.getPassword();
  if (!password) return undefined;
  const encoded = Buffer.from(`gizzi:${password}`).toString('base64');
  return { username: 'gizzi', password, header: `Basic ${encoded}` };
});

// Per-session passwords are not persisted across restarts
ipcMain.handle('sidecar:get-persisted-config', () => null);
ipcMain.handle('sidecar:clear-persisted-config', () => true);

ipcMain.handle('sidecar:start', async () => {
  try { await gizziManager.start(); return true; } catch { return false; }
});

ipcMain.handle('sidecar:stop', () => { gizziManager.stop(); return true; });

ipcMain.handle('sidecar:restart', async () => {
  try {
    gizziManager.stop();
    await gizziManager.start();
    return true;
  } catch { return false; }
});

// ============================================================================
// IPC: Connection settings
// ============================================================================

ipcMain.handle('connection:test', async () => {
  const backend = store.get('backend');
  try {
    const res = await fetch(`${activeBackendUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return { mode: backend.mode, url: activeBackendUrl, status: res.ok ? 'connected' : 'error' };
  } catch {
    return { mode: backend.mode, url: activeBackendUrl, status: 'disconnected' };
  }
});

ipcMain.handle('connection:get-backend', () => {
  const backend = store.get('backend');
  return { mode: backend.mode, url: activeBackendUrl };
});

ipcMain.handle('connection:set-backend', (_event, config: { mode: 'bundled' | 'remote'; remoteUrl?: string }) => {
  store.set('backend', { ...store.get('backend'), ...config });
  mainWindow?.webContents.send('connection:state', config);
});

// ============================================================================
// IPC: VM Setup (onboarding)
// VM images are packaged with the app — no download needed.
// Check resources/vm/ for packaged images per platform.
// ============================================================================

import * as path from 'node:path';
import { createVMManager, VMConfiguration } from '../../native/vm-manager-node/dist/index.js';

// VM Manager instance - created on demand
let vmManager: ReturnType<typeof createVMManager> | null = null;

/** Get host architecture mapped to VM image architecture naming */
function getVmArch(): string {
  const arch = process.arch;
  if (arch === 'x64') return 'amd64';
  if (arch === 'arm64') return 'arm64';
  return arch;
}

/** Get VM images directory - supports both packaged and dev paths */
function getVmImagesPath(): string | null {
  const arch = getVmArch();
  
  // Packaged app: resources/vm/${platform}/
  const packagedPath = path.join(process.resourcesPath ?? '', 'vm');
  if (fs.existsSync(packagedPath)) {
    const files = fs.readdirSync(packagedPath);
    const hasVmFiles = files.some(f => 
      f.endsWith('.raw') || f.endsWith('.qcow2') || f.endsWith('.vhd') ||
      f.endsWith('.ipsw') || f === 'kernel' || f === 'rootfs.ext4' ||
      f.endsWith('.ext4') || f.startsWith('vmlinux') || f.startsWith('initrd')
    );
    if (hasVmFiles) return packagedPath;
  }
  
  // Dev: Check ~/.allternit/vm-images/
  const home = app.getPath('home');
  const devPath = path.join(home, '.allternit/vm-images');
  if (fs.existsSync(devPath)) {
    const files = fs.readdirSync(devPath);
    const hasVmFiles = files.some(f => 
      f.startsWith('vmlinux') || f.startsWith('initrd') || f.endsWith('.ext4')
    );
    if (hasVmFiles) return devPath;
  }
  
  return null;
}

/** Get paths to individual VM image files */
function getVmImagePaths(): { kernel?: string; initrd?: string; rootfs?: string } | null {
  const imagesPath = getVmImagesPath();
  if (!imagesPath) return null;
  
  const arch = getVmArch();
  const archSuffix = arch === 'amd64' ? '' : `-${arch}`;
  const files = fs.readdirSync(imagesPath);
  
  // Try architecture-specific names first, then legacy fallback
  const kernel = files.find(f => f === `vmlinux-6.5.0-allternit${archSuffix}`)
    || files.find(f => f.startsWith('vmlinux') || f === 'kernel');
  const initrd = files.find(f => f === `initrd.img-6.5.0-allternit${archSuffix}`)
    || files.find(f => f.startsWith('initrd') || f === 'initrd.img');
  const rootfs = files.find(f => f === `ubuntu-22.04-allternit-v1.1.0${archSuffix}.ext4`)
    || files.find(f => f.endsWith('.ext4') || f.endsWith('.raw') || f === 'rootfs.ext4');
  
  if (!kernel || !rootfs) return null;
  
  return {
    kernel: path.join(imagesPath, kernel),
    initrd: initrd ? path.join(imagesPath, initrd) : undefined,
    rootfs: path.join(imagesPath, rootfs),
  };
}

ipcMain.handle('vm-setup:check-connectivity', async () => {
  const [internet, github, services] = await Promise.allSettled([
    fetch('https://1.1.1.1', { signal: AbortSignal.timeout(3000) }),
    fetch('https://github.com', { signal: AbortSignal.timeout(3000) }),
    fetch('https://allternit.com', { signal: AbortSignal.timeout(3000) }),
  ]);
  return {
    internet: internet.status === 'fulfilled',
    github: github.status === 'fulfilled',
    allternitServices: services.status === 'fulfilled',
  };
});

ipcMain.handle('vm-setup:check-images-exist', () => {
  const images = getVmImagePaths();
  const hasImages = images !== null;
  log.info(`[VM Setup] VM images check: ${hasImages ? 'found' : 'not found'}`, images);
  return hasImages;
});

ipcMain.handle('vm-setup:download-images', async (event) => {
  // VM images are packaged — skip download, just verify and report progress
  const images = getVmImagePaths();
  
  if (!images) {
    log.warn('[VM Setup] No VM images found — cannot proceed');
    throw new Error('VM images not found. Please ensure VM images are packaged in resources/vm/');
  }
  
  // Calculate total size
  let totalSize = 0;
  for (const [name, filePath] of Object.entries(images)) {
    if (filePath && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      totalSize += stat.size;
      log.info(`[VM Setup] ${name}: ${filePath} (${Math.round(stat.size / 1024 / 1024)}MB)`);
    }
  }
  
  log.info(`[VM Setup] Using packaged VM images (${Math.round(totalSize / 1024 / 1024)}MB total)`);
  
  // Send complete progress event
  event.sender.send('vm-setup:download-progress', {
    stage: 'complete',
    fileName: 'packaged-vm',
    bytesDownloaded: totalSize,
    totalBytes: totalSize,
    speed: 0,
    eta: 0,
  });
  
  return true;
});

ipcMain.handle('vm-setup:initialize-vm', async (event) => {
  const images = getVmImagePaths();
  
  if (!images || !images.kernel || !images.rootfs) {
    throw new Error('VM images not found');
  }
  
  // Create VM Manager with packaged image paths
  const vmConfig: VMConfiguration = {
    vmName: 'allternit-vm',
    kernelPath: images.kernel,
    initrdPath: images.initrd,
    rootfsPath: images.rootfs,
    cpuCount: 4,
    memorySizeMB: 4096,
    vsockPort: 8080,
    socketPath: path.join(app.getPath('userData'), 'allternit-vm.sock'),
  };
  
  // Clean up any existing VM manager
  if (vmManager) {
    try {
      await vmManager.stop();
    } catch {
      // Ignore cleanup errors
    }
    vmManager = null;
  }
  
  // Create new VM manager
  vmManager = createVMManager(vmConfig);
  
  // Report progress during startup
  event.sender.send('vm-setup:init-progress', {
    stage: 'verifying',
    message: 'Verifying VM images...',
    progress: 10,
  });
  
  // Verify images exist
  const imagesExist = await vmManager.checkImages();
  if (!imagesExist) {
    throw new Error('VM images verification failed');
  }
  
  event.sender.send('vm-setup:init-progress', {
    stage: 'booting',
    message: 'Starting Linux VM...',
    progress: 40,
  });
  
  try {
    // Start the VM
    await vmManager.start();
    
    event.sender.send('vm-setup:init-progress', {
      stage: 'connecting',
      message: 'Connecting to VM services...',
      progress: 80,
    });
    
    // Small delay for services to initialize
    await new Promise(r => setTimeout(r, 1000));
    
    event.sender.send('vm-setup:init-progress', {
      stage: 'ready',
      message: 'VM Ready!',
      progress: 100,
    });
    
    log.info('[VM Setup] VM started successfully');
    return true;
  } catch (error) {
    log.error('[VM Setup] Failed to start VM:', error);
    throw new Error(`Failed to start VM: ${(error as Error).message}`);
  }
});

ipcMain.handle('vm-setup:get-vm-status', async (): Promise<'running' | 'stopped' | 'error'> => {
  if (!vmManager) return 'stopped';
  try {
    const status = vmManager.getStatus();
    // Map VM state to simplified status
    switch (status.state) {
      case 'running':
        return 'running';
      case 'error':
        return 'error';
      case 'stopped':
      case 'stopping':
      case 'starting':
      case 'paused':
      default:
        return 'stopped';
    }
  } catch {
    return 'error';
  }
});

// ============================================================================
// IPC: Chrome embed (side-by-side browser)
// Stubs — full implementation requires chrome-embed/ wiring in a future pass.
// ============================================================================

ipcMain.handle('chrome:launch', () => ({
  success: false,
  error: 'Chrome embed not yet available in this build',
}));

ipcMain.handle('chrome:navigate', () => ({
  success: false,
  error: 'Chrome embed not yet available in this build',
}));

ipcMain.handle('chrome:close', () => ({ success: false }));

// ============================================================================
// IPC: Extension Bridge
// Lets the renderer subscribe to Chrome extension messages and send responses.
// ============================================================================

ipcMain.handle('extension:get-status', () => ({
  connected: extensionSocket !== null && !extensionSocket.destroyed,
}));

ipcMain.handle('extension:send', (_event, message: unknown) => {
  if (extensionSocket && !extensionSocket.destroyed) {
    extensionSocket.write(JSON.stringify(message) + '\n');
    return true;
  }
  return false;
});

// ============================================================================
// IPC: Tunnel (Cloudflare Web Access)
// ============================================================================

ipcMain.handle('tunnel:enable', async () => {
  try {
    const url = await tunnelManager.enableWebAccess();
    return { success: true, url };
  } catch (error) {
    log.error('[Tunnel] Failed to enable web access:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Start tunnel only — no browser redirect. Used by the in-app onboarding wizard
// so it can register the backend directly without opening a system browser tab.
ipcMain.handle('tunnel:start', async () => {
  try {
    const url = await tunnelManager.start();
    const token = tunnelManager.getToken();
    return { success: true, url, token };
  } catch (error) {
    log.error('[Tunnel] Failed to start:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('tunnel:disable', () => {
  tunnelManager.stop();
  return { success: true };
});

ipcMain.handle('tunnel:get-url', () => tunnelManager.getUrl());

ipcMain.handle('tunnel:get-status', () => tunnelManager.getState());

// ============================================================================
// IPC: Onboarding
// ============================================================================

ipcMain.handle('app:is-first-launch', () => !store.get('onboardingComplete'));

ipcMain.handle('app:complete-onboarding', () => {
  store.set('onboardingComplete', true);
  return true;
});
