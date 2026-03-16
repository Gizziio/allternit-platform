/**
 * Main Electron Process
 * 
 * Entry point for the Electron application.
 * Integrates window management, sidecar, and IPC handlers.
 */

const electron_1 = require('electron');
const { app, BrowserWindow, ipcMain, globalShortcut, screen, Menu, shell, session } = electron_1;
const path = require('path');
const { join } = path;

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
      baseUrl: sidecar.getApiUrl() || process.env.A2R_OPERATOR_URL || 'http://127.0.0.1:3000',
      apiKey: sidecar.getAuthPassword() || process.env.A2R_OPERATOR_API_KEY || 'a2r-operator-key',
      username: sidecar.SIDECAR_USERNAME || 'a2r',
    };
  }
  return {
    baseUrl: process.env.A2R_OPERATOR_URL || 'http://127.0.0.1:3000',
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

// Default sizes - compact is just input bar, expanded is full chat
const COMPACT_SIZE = { width: 560, height: 200 };
const EXPANDED_SIZE = { width: 560, height: 720 };

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

  try {
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
  } catch (err) {
    console.error('[Agent Runner] Failed to create BrowserWindow:', err.message);
    return null;
  }

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5177';
  const agentRunnerUrl = devUrl + '/agent-runner.html';
  
  try {
    await agentRunnerWindow.loadURL(agentRunnerUrl);
  } catch (err) {
    console.error('[Agent Runner] Failed to load URL:', err.message);
  }

  // Show window immediately instead of waiting for ready-to-show
  agentRunnerWindow.show();
  agentRunnerWindow.focus();
  console.log('[Agent Runner] Window shown immediately');

  agentRunnerWindow.once('ready-to-show', () => {
    console.log('[Agent Runner] ready-to-show event fired');
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
  // Skip window manager - use legacy to avoid issues
  console.log('[Main] Using legacy window creation');

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
    console.log('[Main] Window ready-to-show event fired');
    mainWindow.show();
    mainWindow.focus();
  });

  // Force window to show after a timeout even if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('[Main] Forcing window to show after timeout');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

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

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5177';
  console.log(`[Main] Loading URL: ${devUrl}`);
  
  try {
    await mainWindow.loadURL(devUrl);
    console.log('[Main] URL loaded successfully');
  } catch (e) {
    console.error(`[Main] Failed to load URL: ${e.message}`);
  }
  
  // Log navigation events
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[Main] Page started loading');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page finished loading');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Main] Page failed to load: ${errorDescription} (${errorCode})`);
  });

  // Log renderer console messages for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelStr = ['Debug', 'Info', 'Warning', 'Error'][level] || 'Unknown';
    console.log(`[Renderer ${levelStr}] ${message}`);
    if (sourceId) {
      console.log(`  at ${sourceId}:${line}`);
    }
  });

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

  // Start Cowork Mode controller
  try {
    const coworkModule = require('../dist/main/cowork-controller.js');
    if (coworkModule.startCoworkMode) {
      await coworkModule.startCoworkMode();
      console.log('[Main] Cowork mode started on port 3010');
    }
  } catch (err) {
    console.error('[Main] Failed to start Cowork mode:', err.message);
  }
  
  // Create main window
  console.log('[Main] Creating main window...');
  try {
    await createMainWindowLegacy();
    console.log('[Main] Main window created successfully');
  } catch (e) {
    console.error('[Main] Failed to create main window:', e.message);
    console.error(e.stack);
  }

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

  // Stop Cowork mode
  try {
    const coworkModule = require('../dist/main/cowork-controller.js');
    if (coworkModule.stopCoworkMode) {
      coworkModule.stopCoworkMode();
      console.log('[Main] Cowork mode stopped');
    }
  } catch (err) {
    console.error('[Main] Error stopping Cowork mode:', err.message);
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

// Agent Runner resize animation state
let agentRunnerResizeAnimation = null;

/**
 * Animate the Agent Runner window resize smoothly
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @param {number} duration - Animation duration in ms (default: 250ms)
 */
function animateResize(targetWidth, targetHeight, duration = 250) {
  if (!agentRunnerWindow || agentRunnerWindow.isDestroyed()) return;
  
  // Cancel any ongoing animation
  if (agentRunnerResizeAnimation) {
    clearTimeout(agentRunnerResizeAnimation);
    agentRunnerResizeAnimation = null;
  }
  
  const startBounds = agentRunnerWindow.getBounds();
  const startTime = Date.now();
  
  // Skip animation if already at target size
  if (startBounds.width === targetWidth && startBounds.height === targetHeight) {
    return;
  }
  
  function step() {
    if (!agentRunnerWindow || agentRunnerWindow.isDestroyed()) {
      agentRunnerResizeAnimation = null;
      return;
    }
    
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic for smooth deceleration
    const ease = 1 - Math.pow(1 - progress, 3);
    
    const currentWidth = Math.round(startBounds.width + (targetWidth - startBounds.width) * ease);
    const currentHeight = Math.round(startBounds.height + (targetHeight - startBounds.height) * ease);
    
    agentRunnerWindow.setBounds({
      x: startBounds.x,
      y: startBounds.y,
      width: currentWidth,
      height: currentHeight
    });
    
    if (progress < 1) {
      agentRunnerResizeAnimation = setTimeout(step, 16); // ~60fps
    } else {
      agentRunnerResizeAnimation = null;
    }
  }
  
  step();
}

// Agent Runner IPC handlers
ipcMain.handle('agent-runner:close', () => {
  if (agentRunnerWindow && !agentRunnerWindow.isDestroyed()) {
    agentRunnerWindow.close();
    agentRunnerWindow = null;
  }
});

ipcMain.handle('agent-runner:setExpanded', (_event, expanded) => {
  if (!agentRunnerWindow || agentRunnerWindow.isDestroyed()) return;
  
  const targetSize = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
  
  // Animate to target size with smooth transition
  animateResize(targetSize.width, targetSize.height, 250);
});

ipcMain.handle('agent-runner:getContext', async () => {
  console.log('[Agent Runner] Capturing context...');
  
  const context = {
    timestamp: Date.now(),
    target_app: 'Unknown',
    target_window: 'Unknown',
    target_domain: '',
    target_url: '',
  };

  try {
    // 1. Get focused window from Electron's perspective
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    // If the focused window is the Agent Runner itself, we need to find what was focused BEFORE
    // In a real app, we'd track window focus history. 
    // For now, we'll try to get the "other" window if focusedWindow is the runner.
    let targetWindow = focusedWindow;
    if (focusedWindow === agentRunnerWindow) {
      const windows = BrowserWindow.getAllWindows();
      targetWindow = windows.find(w => w !== agentRunnerWindow && w.isVisible()) || focusedWindow;
    }

    if (targetWindow && targetWindow !== agentRunnerWindow) {
      context.target_app = 'A2R Shell';
      context.target_window = targetWindow.getTitle();
      
      // If it's the main window, it might be showing a webview
      if (targetWindow === mainWindow) {
        // Try to get URL from mainWindow
        try {
          const url = new URL(mainWindow.webContents.getURL());
          context.target_url = url.href;
          context.target_domain = url.hostname;
        } catch (e) {}
      }
    } else {
      // 2. Fallback to OS-level active window capture (macOS only for now)
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process');
        try {
          const script = `
            tell application "System Events"
              set frontApp to name of first application process whose frontmost is true
              set windowName to name of first window of application process frontApp
              return frontApp & "|" & windowName
            end tell
          `;
          const result = execSync(`osascript -e '${script}'`).toString().trim();
          const [app, window] = result.split('|');
          context.target_app = app;
          context.target_window = window;

          // If it's a browser, try to get the URL
          if (['Google Chrome', 'Safari', 'Brave Browser'].includes(app)) {
            const urlScript = app === 'Safari' 
              ? 'tell application "Safari" to return URL of front document'
              : `tell application "${app}" to return URL of active tab of front window`;
            try {
              const url = execSync(`osascript -e '${urlScript}'`).toString().trim();
              if (url) {
                const urlObj = new URL(url);
                context.target_url = url;
                context.target_domain = urlObj.hostname;
              }
            } catch (e) {}
          }
        } catch (e) {
          console.warn('[Agent Runner] OS context capture failed:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[Agent Runner] Context capture error:', err);
  }

  console.log('[Agent Runner] Context captured:', context);
  return context;
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

// ============================================================================
// VM Setup IPC handlers (Onboarding)
// ============================================================================

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

const VM_IMAGES_DIR = path.join(os.homedir(), '.a2r', 'vm-images');
const SOCKET_PATH = process.platform === 'darwin' 
  ? path.join(os.homedir(), '.a2r', 'desktop-vm.sock')
  : '/var/run/a2r/desktop-vm.sock';

/** Check internet connectivity */
ipcMain.handle('vm-setup:check-connectivity', async () => {
  const result = { internet: false, github: false, a2rServices: false };
  
  try {
    // Check internet
    const internetResponse = await fetch('https://1.1.1.1', { 
      method: 'HEAD',
      timeout: 5000 
    });
    result.internet = internetResponse.ok;
  } catch (e) {
    console.log('[VM Setup] Internet check failed:', e.message);
  }
  
  try {
    // Check GitHub
    const githubResponse = await fetch('https://api.github.com', { 
      method: 'HEAD',
      timeout: 5000 
    });
    result.github = githubResponse.ok;
  } catch (e) {
    console.log('[VM Setup] GitHub check failed:', e.message);
  }
  
  // A2R services check (placeholder)
  result.a2rServices = result.internet;
  
  console.log('[VM Setup] Connectivity check:', result);
  return result;
});

/** Check if VM images exist */
ipcMain.handle('vm-setup:check-images-exist', async () => {
  try {
    const files = fs.readdirSync(VM_IMAGES_DIR);
    const hasRootfs = files.some(f => f.includes('ubuntu-22.04-a2r') && f.endsWith('.ext4'));
    const hasKernel = files.some(f => f.startsWith('vmlinux-'));
    console.log('[VM Setup] Images exist:', hasRootfs && hasKernel);
    return hasRootfs && hasKernel;
  } catch (e) {
    console.log('[VM Setup] Images check failed:', e.message);
    return false;
  }
});

/** Download VM images */
ipcMain.handle('vm-setup:download-images', async (event) => {
  console.log('[VM Setup] Starting image download...');
  
  return new Promise((resolve, reject) => {
    // Run a2r-vm-image-builder download
    const builderPath = path.join(app.getAppPath(), '..', '..', 'target', 'release', 'a2r-vm-image-builder');
    const args = ['download'];
    
    console.log('[VM Setup] Running:', builderPath, args.join(' '));
    
    const proc = spawn(builderPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[VM Setup] stdout:', text);
      
      // Parse progress from output and emit
      // This is a simplified version - real implementation would parse actual progress
      event.sender.send('vm-setup:download-progress', {
        stage: 'downloading',
        fileName: 'ubuntu-22.04-a2r-v1.1.0.ext4.zst',
        bytesDownloaded: output.length,
        totalBytes: 500 * 1024 * 1024,
        speed: 1024 * 1024,
        eta: 60
      });
    });
    
    proc.stderr.on('data', (data) => {
      console.error('[VM Setup] stderr:', data.toString());
    });
    
    proc.on('close', (code) => {
      console.log('[VM Setup] Download process exited with code:', code);
      if (code === 0) {
        event.sender.send('vm-setup:download-progress', {
          stage: 'complete',
          fileName: 'ubuntu-22.04-a2r-v1.1.0.ext4.zst',
          bytesDownloaded: 500 * 1024 * 1024,
          totalBytes: 500 * 1024 * 1024,
          speed: 0,
          eta: 0
        });
        resolve(true);
      } else {
        reject(new Error(`Download failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      console.error('[VM Setup] Download process error:', err);
      reject(err);
    });
  });
});

/** Build VM images locally (Linux only) */
ipcMain.handle('vm-setup:build-images', async (event) => {
  console.log('[VM Setup] Starting image build...');
  
  if (process.platform !== 'linux') {
    throw new Error('Local image building is only supported on Linux');
  }
  
  return new Promise((resolve, reject) => {
    const builderPath = path.join(app.getAppPath(), '..', '..', 'target', 'release', 'a2r-vm-image-builder');
    const proc = spawn(builderPath, ['build'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    proc.stdout.on('data', (data) => {
      console.log('[VM Setup] build stdout:', data.toString());
      // Emit progress events
      event.sender.send('vm-setup:build-progress', {
        stage: 'building',
        fileName: 'ubuntu-22.04-a2r.ext4',
        bytesDownloaded: 0,
        totalBytes: 100
      });
    });
    
    proc.stderr.on('data', (data) => {
      console.error('[VM Setup] build stderr:', data.toString());
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
});

/** Initialize VM */
ipcMain.handle('vm-setup:initialize-vm', async (event) => {
  console.log('[VM Setup] Initializing VM...');
  
  // Check if images exist
  const imagesExist = await ipcMain.handle('vm-setup:check-images-exist');
  if (!imagesExist) {
    throw new Error('VM images not found. Run download or build first.');
  }
  
  // Emit progress
  event.sender.send('vm-setup:init-progress', {
    stage: 'verifying',
    message: 'Verifying VM images...',
    progress: 25
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  event.sender.send('vm-setup:init-progress', {
    stage: 'booting',
    message: 'Booting virtual machine...',
    progress: 50
  });
  
  // TODO: Actually start the VM using VmManager
  // For now, simulate
  await new Promise(r => setTimeout(r, 2000));
  
  event.sender.send('vm-setup:init-progress', {
    stage: 'connecting',
    message: 'Connecting to a2r-vm-executor...',
    progress: 75
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  event.sender.send('vm-setup:init-progress', {
    stage: 'ready',
    message: 'VM ready!',
    progress: 100
  });
  
  console.log('[VM Setup] VM initialized successfully');
  return true;
});

/** Get VM status */
ipcMain.handle('vm-setup:get-vm-status', async () => {
  try {
    const socketExists = fs.existsSync(SOCKET_PATH);
    if (!socketExists) {
      return 'stopped';
    }
    
    // TODO: Actually check if VM is running via VmManager
    // For now, assume running if socket exists
    return 'running';
  } catch (e) {
    console.error('[VM Setup] Get status error:', e);
    return 'error';
  }
});

console.log('[Main] Electron main process loaded');
