/**
 * Main Electron Process
 * 
 * Entry point for the Electron application.
 * Integrates window management, sidecar, and IPC handlers.
 */

const electron_1 = require('electron');
const { app, BrowserWindow, ipcMain, globalShortcut, screen, Menu, shell, session } = electron_1;
const { join } = require('path');

// Chrome Embed Module - for embedding real Chrome browser
let chromeEmbed = null;
try {
    chromeEmbed = require('./chrome-embed/index.js');
    console.log('[Main] Chrome Embed module loaded');
} catch (err) {
    console.error('[Main] Failed to load Chrome Embed:', err.message);
}

// ============================================================================
// Window Management Integration
// ============================================================================

// Try to import window management module (compiled from TypeScript)
let windowManager;
let createWindow;
let registerWindowIPC;
let registerShortcutCleanup;

// Try to import menu system module
let menuSystem;
let buildApplicationMenu;
let registerContextMenu;
let initializeMenus;
let updateWindowMenu;

try {
  const windowModule = require('../dist/main/window/index.js');
  windowManager = windowModule.windowManager;
  createWindow = windowModule.createWindow;
  registerWindowIPC = windowModule.registerWindowIPC;
  registerShortcutCleanup = windowModule.registerShortcutCleanup;
  console.log('[Main] Window management module loaded');
} catch (e) {
  console.error('[Main] Window management module not available:', e.message);
}

// Load the menu system
try {
  menuSystem = require('./menu/index.cjs');
  buildApplicationMenu = menuSystem.buildApplicationMenu;
  registerContextMenu = menuSystem.registerContextMenu;
  initializeMenus = menuSystem.initializeMenus;
  updateWindowMenu = menuSystem.updateWindowMenu;
  console.log('[Main] Menu system loaded');
} catch (e) {
  console.error('[Main] Menu system not available:', e.message);
}

// ============================================================================
// Sidecar Integration
// ============================================================================

let sidecar = null;
let mainWindow = null;
let agentRunnerWindow = null;

// Try to import sidecar module (may not exist in dev)
try {
  sidecar = require('./sidecar-integration.cjs');
} catch (e) {
  console.log('[Main] Sidecar module not found, will use external API');
}

// Helper to get sidecar API URL and password for requests
function getSidecarConfig() {
  if (sidecar && sidecar.getApiUrl && sidecar.getAuthPassword) {
    return {
      baseUrl: sidecar.getApiUrl() || process.env.A2R_OPERATOR_URL || 'http://127.0.0.1:3010',
      apiKey: sidecar.getAuthPassword() || process.env.A2R_OPERATOR_API_KEY || 'a2r-operator-key',
      username: sidecar.SIDECAR_USERNAME || 'a2r',
    };
  }
  return {
    baseUrl: process.env.A2R_OPERATOR_URL || 'http://127.0.0.1:3010',
    apiKey: process.env.A2R_OPERATOR_API_KEY || 'a2r-operator-key',
    username: 'a2r',
  };
}

async function operatorFetch(path) {
  const config = getSidecarConfig();
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/v1/telemetry${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Operator responded with ${response.status}`);
  }
  return response.json();
}

function broadcastTelemetryEvent(payload) {
  const eventName = 'a2r-usage:probe:event';
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(eventName, payload);
  }
}

// ============================================================================
// Window Creation (Legacy & New)
// ============================================================================

// Default sizes (height accounts for header + content)
const COMPACT_SIZE = { width: 720, height: 213 };
const EXPANDED_SIZE = { width: 1000, height: 700 };

async function createAgentRunnerWindow() {
  // If window exists, just show it
  if (agentRunnerWindow && !agentRunnerWindow.isDestroyed()) {
    if (!agentRunnerWindow.isVisible()) {
      agentRunnerWindow.show();
    }
    agentRunnerWindow.focus();
    return agentRunnerWindow;
  }

  // Create new window at compact size
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const x = Math.round((screenWidth - COMPACT_SIZE.width) / 2);
  const y = Math.round((screenHeight - COMPACT_SIZE.height) / 2);

  agentRunnerWindow = new BrowserWindow({
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    x, y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5177';
  await agentRunnerWindow.loadURL(devUrl + '/agent-runner.html');

  agentRunnerWindow.once('ready-to-show', () => {
    agentRunnerWindow.show();
    agentRunnerWindow.focus();
  });

  agentRunnerWindow.on('closed', () => {
    agentRunnerWindow = null;
  });

  return agentRunnerWindow;
}

async function toggleAgentRunnerWindow() {
  if (agentRunnerWindow && !agentRunnerWindow.isDestroyed() && agentRunnerWindow.isVisible()) {
    agentRunnerWindow.hide();
  } else {
    await createAgentRunnerWindow();
  }
}

async function createMainWindowLegacy() {
  // Use window manager if available
  if (windowManager && createWindow) {
    try {
      const window = await createWindow({ type: 'main', id: 'main' });
      if (!window.isDestroyed() && !window.isVisible()) {
        window.show();
        window.focus();
      }
      mainWindow = window;
      return window;
    } catch (e) {
      console.error('[Main] Window manager failed, using legacy:', e.message);
    }
  }

  // Legacy window creation
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'A2rchitect Shell',
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 24, y: 28 },
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      webviewTag: true,
      allowRunningInsecureContent: true,
    },
  });

  // Set Chrome User-Agent for webview to be recognized as real Chrome
  // Electron 28 uses Chrome 120
  const chromeUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  mainWindow.webContents.setUserAgent(chromeUserAgent);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window resize - reposition embedded Chrome
  mainWindow.on('resize', () => {
    chromeEmbed.resizeChrome(mainWindow);
  });

  mainWindow.on('move', () => {
    chromeEmbed.resizeChrome(mainWindow);
  });

  // Register context menu for the window
  if (registerContextMenu) {
    try {
      registerContextMenu(mainWindow);
      console.log('[Main] Context menu registered for main window');
    } catch (e) {
      console.error('[Main] Failed to register context menu:', e.message);
    }
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5177';
  await mainWindow.loadURL(devUrl);

  // Enable downloads in webview
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const totalBytes = item.getTotalBytes();
    console.log(`[Download] Starting: ${fileName} (${totalBytes} bytes)`);

    // Set save path to Downloads folder
    const downloadsPath = path.join(app.getPath('downloads'), fileName);
    item.setSavePath(downloadsPath);

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('[Download] Interrupted');
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          console.log('[Download] Paused');
        } else {
          const percent = (item.getReceivedBytes() / totalBytes) * 100;
          console.log(`[Download] Progress: ${percent.toFixed(1)}%`);
        }
      }
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log(`[Download] Completed: ${downloadsPath}`);
        // Show in Finder when complete
        shell.showItemInFolder(downloadsPath);
      } else {
        console.log(`[Download] Failed: ${state}`);
      }
    });
  });

  // Set User-Agent on webview sessions as well
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = chromeUserAgent;
    callback({ requestHeaders: details.requestHeaders });
  });

  return mainWindow;
}

// ============================================================================
// Application Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  // Register window IPC handlers
  if (registerWindowIPC) {
    try {
      registerWindowIPC();
      console.log('[Main] Window IPC handlers registered');
    } catch (e) {
      console.error('[Main] Failed to register window IPC:', e.message);
    }
  }

  // Register shortcut cleanup
  if (registerShortcutCleanup) {
    registerShortcutCleanup();
  }

  // Build and set application menu
  if (initializeMenus) {
    try {
      initializeMenus();
      console.log('[Main] Application menu initialized');
    } catch (e) {
      console.error('[Main] Failed to initialize application menu:', e.message);
    }
  } else if (buildApplicationMenu) {
    try {
      const menu = buildApplicationMenu();
      Menu.setApplicationMenu(menu);
      console.log('[Main] Application menu set');
    } catch (e) {
      console.error('[Main] Failed to set application menu:', e.message);
    }
  }

  // Start Rust API sidecar if available
  if (sidecar && sidecar.startSidecar) {
    try {
      await sidecar.startSidecar();
    } catch (err) {
      console.error('[Main] Failed to start sidecar:', err);
      // Continue anyway - API might be running externally
    }
    
    // Forward sidecar status changes to renderer
    if (sidecar.onSidecarStatusChanged) {
      sidecar.onSidecarStatusChanged((status) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sidecar:status-changed', status);
        }
      });
    }
  }
  
  // Create main window
  await createMainWindowLegacy();

  // Register Chrome IPC handler - opens URL in REAL Chrome and positions it over Electron window
  ipcMain.handle('chrome:open', async (event, url) => {
    console.log('[Chrome] Opening URL in REAL Chrome:', url);
    try {
      const { exec } = require('child_process');
      
      // Get Electron window bounds
      const bounds = mainWindow.getBounds();
      const contentBounds = mainWindow.getContentBounds();
      
      // Calculate content area offset (accounting for title bar, etc.)
      const offsetX = contentBounds.x - bounds.x;
      const offsetY = contentBounds.y - bounds.y;
      const contentWidth = contentBounds.width;
      const contentHeight = contentBounds.height;
      
      // Calculate screen coordinates for the content area
      const chromeX = bounds.x + offsetX;
      const chromeY = bounds.y + offsetY;
      
      console.log('[Chrome] Positioning Chrome at:', { x: chromeX, y: chromeY, width: contentWidth, height: contentHeight });
      
      // Launch Chrome and position it using AppleScript
      const escapedUrl = url.replace(/"/g, '\\"');
      const appleScript = `
        tell application "Google Chrome"
          activate
          open location "${escapedUrl}"
          delay 1
          tell window 1
            set bounds to {${chromeX}, ${chromeY}, ${chromeX + contentWidth}, ${chromeY + contentHeight}}
          end tell
        end tell
      `;
      
      exec(`osascript -e '${appleScript}'`, (error, stdout, stderr) => {
        if (error) {
          console.error('[Chrome] Failed to position Chrome:', error, stderr);
        } else {
          console.log('[Chrome] Chrome positioned successfully');
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('[Chrome] Failed to open Chrome:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('chrome:navigate', async (event, url) => {
    console.log('[Chrome Embed] Navigating to:', url);
    try {
      await chromeEmbed.navigateChrome(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('chrome:close', async () => {
    console.log('[Chrome Embed] Closing Chrome');
    chromeEmbed.closeChrome();
    return { success: true };
  });

  // Register global shortcut for agent runner
  globalShortcut.register('CommandOrControl+Shift+A', toggleAgentRunnerWindow);

  // macOS: re-create window when dock icon is clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindowLegacy();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  
  // Save window states before quitting
  if (windowManager) {
    windowManager.saveAllWindowStates?.();
  }
});

// macOS: prevent default behavior of closing all windows
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// IPC Handlers
// ============================================================================

// Sidecar IPC handlers
ipcMain.handle('sidecar:start', async () => {
  if (sidecar && sidecar.startSidecar) {
    try {
      await sidecar.startSidecar();
      return true;
    } catch (err) {
      console.error('[Main] Failed to start sidecar:', err);
      return false;
    }
  }
  return false;
});

ipcMain.handle('sidecar:stop', async () => {
  if (sidecar && sidecar.stopSidecar) {
    try {
      sidecar.stopSidecar();
      return true;
    } catch (err) {
      console.error('[Main] Failed to stop sidecar:', err);
      return false;
    }
  }
  return false;
});

ipcMain.handle('sidecar:restart', async () => {
  if (sidecar && sidecar.restartSidecar) {
    try {
      await sidecar.restartSidecar();
      return true;
    } catch (err) {
      console.error('[Main] Failed to restart sidecar:', err);
      return false;
    }
  }
  return false;
});

ipcMain.handle('sidecar:get-status', () => {
  if (sidecar && sidecar.getSidecarStatus) {
    return sidecar.getSidecarStatus();
  }
  return 'stopped';
});

ipcMain.handle('sidecar:get-api-url', () => {
  if (sidecar && sidecar.getApiUrl) {
    return sidecar.getApiUrl();
  }
  return undefined;
});

ipcMain.handle('sidecar:get-auth-password', () => {
  if (sidecar && sidecar.getAuthPassword) {
    return sidecar.getAuthPassword();
  }
  return undefined;
});

ipcMain.handle('sidecar:get-basic-auth', () => {
  if (sidecar && sidecar.getBasicAuthCredentials) {
    return sidecar.getBasicAuthCredentials();
  }
  return undefined;
});

ipcMain.handle('sidecar:get-persisted-config', () => {
  if (sidecar && sidecar.loadPersistedConfig) {
    return sidecar.loadPersistedConfig();
  }
  return null;
});

ipcMain.handle('sidecar:clear-persisted-config', () => {
  if (sidecar && sidecar.clearPersistedConfig) {
    sidecar.clearPersistedConfig();
    return true;
  }
  return false;
});

// Agent Runner IPC handlers
ipcMain.handle('agent-runner:close', () => {
  if (agentRunnerWindow && !agentRunnerWindow.isDestroyed()) {
    agentRunnerWindow.hide();
  }
});

ipcMain.handle('agent-runner:setExpanded', (_event, expanded) => {
  if (!agentRunnerWindow || agentRunnerWindow.isDestroyed()) return;
  
  const targetSize = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
  const bounds = agentRunnerWindow.getBounds();
  
  // Expand from top-left corner (keep top-left fixed, grow down-right)
  agentRunnerWindow.setBounds({ 
    x: bounds.x, 
    y: bounds.y, 
    width: targetSize.width, 
    height: targetSize.height 
  });
});

// A2R Usage IPC handlers
ipcMain.handle('a2r-usage:telemetry:providers', async () => {
  return operatorFetch('/providers');
});

ipcMain.handle('a2r-usage:telemetry:snapshot', async (_event, sessionId) => {
  const encoded = encodeURIComponent(sessionId);
  return operatorFetch(`/sessions/${encoded}`);
});

ipcMain.on('a2r-usage:telemetry:refresh', async () => {
  try {
    const providers = await operatorFetch('/providers');
    broadcastTelemetryEvent({ type: 'refresh', providers, timestamp: Date.now() });
  } catch (error) {
    console.error('[a2r-usage]', 'refresh failed', error);
  }
});

ipcMain.handle('a2r-usage:invoke', async (_event, command, ...args) => {
  switch (command) {
    case 'init_panel':
      console.log('[a2r-usage] Initializing panel');
      return { success: true };
    
    case 'hide_panel':
      console.log('[a2r-usage] Hiding panel');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide();
      }
      return { success: true };
      
    case 'list_plugins':
      try {
        const providers = await operatorFetch('/providers');
        return providers.map(provider => ({
          id: provider.id,
          name: provider.name,
          iconUrl: provider.iconUrl || null,
          brandColor: provider.brandColor || '#6366f1'
        }));
      } catch (error) {
        console.error('[a2r-usage] Failed to list plugins:', error);
        return [];
      }
      
    default:
      console.warn(`[a2r-usage] Unknown command: ${command}`);
      return { error: `Unknown command: ${command}` };
  }
});

ipcMain.handle('a2r-usage:setWindowSize', async (_event, { width, height }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setSize(width, height);
      return { success: true };
    } catch (error) {
      console.error('[a2r-usage] Failed to set window size:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Main window not available' };
});

ipcMain.handle('a2r-usage:getVersion', async () => {
  return app.getVersion();
});

ipcMain.handle('a2r-usage:resolveResource', async (_event, resourcePath) => {
  return join(app.getAppPath(), 'resources', resourcePath);
});

ipcMain.handle('a2r-usage:setTrayIcon', async (_event, iconData) => {
  console.log('[a2r-usage] Setting tray icon:', typeof iconData === 'string' ? iconData.substring(0, 50) + '...' : iconData);
  return { success: true };
});

ipcMain.handle('a2r-usage:setTrayIconAsTemplate', async (_event, value) => {
  console.log('[a2r-usage] Setting tray icon as template:', value);
  return { success: true };
});

ipcMain.handle('a2r-usage:currentMonitor', async () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return { size: { width: primaryDisplay.size.width, height: primaryDisplay.size.height } };
});

console.log('[Main] Electron main process loaded');
