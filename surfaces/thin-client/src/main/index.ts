/**
 * Thin Client Main Process
 * 
 * Handles:
 * - System tray icon
 * - Global hotkey (Cmd/Ctrl+Shift+A)
 * - Floating window management
 * - WebSocket connection to cloud/desktop
 * - Auto-updater
 */

import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, shell } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { ConnectionManager } from './connection-manager';
import { AppDiscovery } from './app-discovery';
import { createLogger } from './logger';

const logger = createLogger('main');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.info('Another instance is already running, quitting...');
  app.quit();
  process.exit(0);
}

// When second instance is attempted, show the window
app.on('second-instance', () => {
  logger.info('Second instance detected, showing window');
  if (mainWindow) {
    showWindow();
  }
});

// Configuration store
const store = new Store<{
  backend: 'cloud' | 'desktop';
  cloudUrl: string;
  desktopPort: number;
  windowPosition: { x: number; y: number };
}>();

// Global state
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let connectionManager: ConnectionManager | null = null;
let appDiscovery: AppDiscovery | null = null;
let isQuitting = false;
let isFirstShow = true;

// Constants
const WINDOW_WIDTH = 520;
const WINDOW_HEIGHT = 600;
const GLOBAL_HOTKEY = 'CommandOrControl+Shift+A';

/**
 * Create the main floating window
 */
function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 480,
    minHeight: 400,
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // macOS specific
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 }, // Hide traffic lights
    roundedCorners: true,
  });

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle window blur - hide instead of close
  window.on('blur', () => {
    // Don't hide on first show to give user time to interact
    if (isFirstShow) return;
    if (!isQuitting && !window.webContents.isDevToolsOpened()) {
      hideWindow();
    }
  });

  // Handle close
  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideWindow();
    }
  });

  // Save position on move
  window.on('moved', () => {
    const bounds = window.getBounds();
    store.set('windowPosition', { x: bounds.x, y: bounds.y });
  });

  return window;
}

/**
 * Create system tray icon
 */
function getTrayIconPath(): string {
  // In development: use project root assets
  // In production: assets are in Resources directory or app.asar
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    return path.join(__dirname, '../../assets/icons/tray-icon.png');
  }
  // In production, assets are copied to Resources directory
  return path.join(process.resourcesPath, 'assets/icons/tray-icon.png');
}

function createTray(): Tray {
  // Create icon (use template image for macOS)
  const iconPath = getTrayIconPath();
  let icon: Electron.NativeImage;
  
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (error) {
    logger.error('Failed to load tray icon from', iconPath, error);
    // Fallback to creating a blank icon
    icon = nativeImage.createEmpty();
  }
  
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  const trayInstance = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Chat',
      accelerator: GLOBAL_HOTKEY,
      click: () => toggleWindow(),
    },
    { type: 'separator' },
    {
      label: 'Connection',
      submenu: [
        {
          label: 'Cloud Mode',
          type: 'radio',
          checked: store.get('backend') === 'cloud',
          click: () => switchBackend('cloud'),
        },
        {
          label: 'Desktop Mode',
          type: 'radio',
          checked: store.get('backend') === 'desktop',
          click: () => switchBackend('desktop'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Discoverable Apps',
      submenu: [
        { label: 'Scanning...', enabled: false },
      ],
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => openSettings(),
    },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => quitApp(),
    },
  ]);

  trayInstance.setToolTip('Gizzi Thin Client');
  trayInstance.setContextMenu(contextMenu);

  // Click to toggle on macOS, right-click shows menu on Windows/Linux
  trayInstance.on('click', () => {
    toggleWindow();
  });

  trayInstance.on('right-click', () => {
    trayInstance.popUpContextMenu();
  });

  return trayInstance;
}

/**
 * Show window at cursor position or saved position
 */
function showWindow(): void {
  if (!mainWindow) {
    mainWindow = createMainWindow();
  }

  const savedPosition = store.get('windowPosition');
  
  if (savedPosition) {
    mainWindow.setPosition(savedPosition.x, savedPosition.y);
  } else {
    // Center on screen
    const { workArea } = require('electron').screen.getPrimaryDisplay();
    const x = Math.round(workArea.x + (workArea.width - WINDOW_WIDTH) / 2);
    const y = Math.round(workArea.y + (workArea.height - WINDOW_HEIGHT) / 2);
    mainWindow.setPosition(x, y);
  }

  mainWindow.show();
  mainWindow.focus();
  
  // Mark first show complete after a delay
  if (isFirstShow) {
    setTimeout(() => {
      isFirstShow = false;
    }, 2000);
  }
}

/**
 * Hide window
 */
function hideWindow(): void {
  if (mainWindow) {
    mainWindow.hide();
  }
}

/**
 * Toggle window visibility
 */
function toggleWindow(): void {
  if (mainWindow?.isVisible() && mainWindow.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

/**
 * Switch backend mode
 */
async function switchBackend(mode: 'cloud' | 'desktop'): Promise<void> {
  store.set('backend', mode);
  
  if (connectionManager) {
    await connectionManager.reconnect(mode);
  }

  // Notify renderer
  mainWindow?.webContents.send('backend-changed', mode);
}

/**
 * Open settings window
 */
function openSettings(): void {
  // TODO: Implement settings window
  logger.info('Opening settings...');
}

/**
 * Check for updates
 */
function checkForUpdates(): void {
  autoUpdater.checkForUpdatesAndNotify();
}

/**
 * Quit application
 */
function quitApp(): void {
  isQuitting = true;
  globalShortcut.unregisterAll();
  app.quit();
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  logger.info('Gizzi Thin Client starting...');

  // Initialize store defaults
  if (!store.get('backend')) {
    store.set('backend', 'desktop');
  }
  if (!store.get('cloudUrl')) {
    store.set('cloudUrl', 'ws://localhost:3010');
  }
  if (!store.get('desktopPort')) {
    store.set('desktopPort', 3010);
  }

  // Create tray
  tray = createTray();

  // Create window (hidden initially)
  mainWindow = createMainWindow();

  // Show window on first launch
  showWindow();

  // Register global hotkey
  const registered = globalShortcut.register(GLOBAL_HOTKEY, () => {
    logger.info(`Global hotkey ${GLOBAL_HOTKEY} pressed`);
    toggleWindow();
  });

  if (!registered) {
    logger.error(`Failed to register global hotkey: ${GLOBAL_HOTKEY}`);
  } else {
    logger.info(`Global hotkey registered: ${GLOBAL_HOTKEY}`);
  }

  // Initialize connection manager
  connectionManager = new ConnectionManager(store, (status) => {
    mainWindow?.webContents.send('connection-status', status);
  });
  connectionManager.connect();

  // Initialize app discovery
  appDiscovery = new AppDiscovery((apps) => {
    mainWindow?.webContents.send('discovered-apps', apps);
    updateTrayMenu(apps);
  });
  appDiscovery.start();

  // Setup auto-updater
  setupAutoUpdater();

  // Setup IPC handlers
  setupIpcHandlers();

  logger.info('Gizzi Thin Client ready');
});

app.on('window-all-closed', () => {
  // Keep running in background (system tray)
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  connectionManager?.disconnect();
  appDiscovery?.stop();
});

app.on('activate', () => {
  // macOS: show window when dock icon clicked
  showWindow();
});

// ============================================================================
// IPC Handlers
// ============================================================================

function setupIpcHandlers(): void {
  // Get connection status
  ipcMain.handle('get-connection-status', () => {
    return connectionManager?.getStatus();
  });

  // Send message to backend
  ipcMain.handle('send-message', async (_, message) => {
    return connectionManager?.sendMessage(message);
  });

  // Get discovered apps
  ipcMain.handle('get-discovered-apps', () => {
    return appDiscovery?.getApps();
  });

  // Connect to specific app
  ipcMain.handle('connect-to-app', async (_, appId) => {
    return appDiscovery?.connectToApp(appId);
  });

  // Get settings
  ipcMain.handle('get-settings', () => {
    return {
      backend: store.get('backend'),
      cloudUrl: store.get('cloudUrl'),
      desktopPort: store.get('desktopPort'),
    };
  });

  // Update settings
  ipcMain.handle('update-settings', (_, settings) => {
    if (settings.backend) store.set('backend', settings.backend);
    if (settings.cloudUrl) store.set('cloudUrl', settings.cloudUrl);
    if (settings.desktopPort) store.set('desktopPort', settings.desktopPort);
    return true;
  });

  // Hide window
  ipcMain.on('hide-window', () => {
    hideWindow();
  });

  // Open external link
  ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url);
  });
}

// ============================================================================
// Auto Updater
// ============================================================================

function setupAutoUpdater(): void {
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
  });
}

// ============================================================================
// Tray Menu Update
// ============================================================================

function updateTrayMenu(apps: Array<{ id: string; name: string; icon?: string }>): void {
  if (!tray) return;

  const appMenuItems = apps.length > 0
    ? apps.map(app => ({
        label: `+ ${app.name}`,
        click: () => appDiscovery?.connectToApp(app.id),
      }))
    : [{ label: 'No apps discovered', enabled: false }];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Chat',
      accelerator: GLOBAL_HOTKEY,
      click: () => toggleWindow(),
    },
    { type: 'separator' },
    {
      label: 'Connection',
      submenu: [
        {
          label: 'Cloud Mode',
          type: 'radio',
          checked: store.get('backend') === 'cloud',
          click: () => switchBackend('cloud'),
        },
        {
          label: 'Desktop Mode',
          type: 'radio',
          checked: store.get('backend') === 'desktop',
          click: () => switchBackend('desktop'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Connect to App',
      submenu: appMenuItems,
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => openSettings(),
    },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click: () => quitApp(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}
