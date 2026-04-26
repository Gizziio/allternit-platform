/**
 * Allternit Desktop — Unified Main Process
 *
 * Unified architecture: Desktop is the control plane.
 * - Manages local backend (bundled, auto-extracted)
 * - Connects to remote backend (VPS)
 * - Version-locked: Desktop 1.2.3 = Backend 1.2.3
 */
import { app, BrowserWindow, ipcMain, nativeTheme, shell, Tray, Menu, dialog, globalShortcut, screen } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import Store from 'electron-store';
import log from 'electron-log';
import { updateElectronApp } from 'update-electron-app';
import fixPath from 'fix-path';
import { backendManager } from './backend-manager.js';
import { gizziManager } from './gizzi-manager.js';
import { platformServerManager } from './platform-server.js';
import { tunnelManager } from './tunnel-manager.js';
import { authManager } from './auth-manager.js';
import { PLATFORM_MANIFEST, shouldUpdateBackend } from './manifest.js';
import { checkPermissions, presentGuide, dismissGuide, getGuideStatus, runPermissionOnboarding, } from './permission-guide.js';
import { featureFlagManager } from './feature-flags.js';
import { persistedState } from './persisted-state.js';
import { workerBus } from './workers/worker-bus.js';
import { mcpHostManager } from './mcp-host-manager.js';
// Fix PATH for macOS
fixPath();
// Configure logging
log.transports.file.resolvePath = () => join(app.getPath('userData'), 'main.log');
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
let mainWindow = null;
let splashWindow = null;
let miniWindow = null;
let tray = null;
let activePlatformUrl = isDev ? 'http://localhost:3013' : 'http://127.0.0.1:3100';
const QUICK_CHAT_HOTKEY = 'CommandOrControl+Shift+A';
const MINI_WINDOW_WIDTH = 520;
const MINI_WINDOW_HEIGHT = 600;
/** Resolved backend URL — set once the app initializes. Used by sdk:get-backend-url IPC. */
let activeBackendUrl = 'http://localhost:8013';
/** Active TCP connection from the native messaging host (Chrome extension bridge) */
let extensionSocket = null;
/** In-session sidecar config — set after gizziManager starts, cleared on stop. */
let persistedSidecarConfig = null;
/** If set, the permission onboarding flow should start when the renderer signals readiness. */
let permissionOnboardingResolver = null;
const store = new Store({
    defaults: {
        windowBounds: { width: 1400, height: 900 },
        theme: 'system',
        backend: {
            mode: 'bundled',
        },
        onboardingComplete: false,
        permissions: {
            promptedDuringOnboarding: false,
        },
    },
});
// ============================================================================
// Splash Window (First-run / Loading)
// ============================================================================
function createSplashWindow() {
    const window = new BrowserWindow({
        width: 480,
        height: 420,
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
      justify-content: flex-start;
      padding: 60px 40px 40px 40px;
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
    .stack-status {
      width: 100%;
      display: grid;
      gap: 8px;
      margin: 18px 0 22px 0;
      max-height: 240px;
      overflow: hidden;
      transition: opacity 220ms ease, transform 220ms ease, max-height 220ms ease, margin 220ms ease;
    }
    .stack-status.hidden {
      opacity: 0;
      transform: translateY(-6px);
      max-height: 0;
      margin: 0;
    }
    .stack-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      font-size: 12px;
    }
    .stack-name {
      color: #c7b19a;
    }
    .stack-value {
      color: #8f6f56;
      text-align: right;
      word-break: break-word;
    }
    .stack-value.up {
      color: #7ec699;
    }
    .stack-value.down {
      color: #e8886a;
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
    .auth-container {
      display: none;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    #waiting {
      display: none;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }
    .btn-login {
      background: linear-gradient(135deg, #E8886A 0%, #D97757 100%);
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(217, 119, 87, 0.3);
      transition: all 0.2s;
      width: 100%;
      margin-bottom: 12px;
    }
    .btn-login:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(217, 119, 87, 0.4);
    }
    .btn-login:active { transform: translateY(0); }
    .btn-quit {
      background: transparent;
      color: rgba(255, 255, 255, 0.4);
      border: none;
      font-size: 13px;
      cursor: pointer;
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

  <div class="stack-status">
    <div class="stack-row">
      <div class="stack-name">Allternit API</div>
      <div class="stack-value" id="svc-api">Starting…</div>
    </div>
    <div class="stack-row">
      <div class="stack-name">Gateway</div>
      <div class="stack-value" id="svc-gateway">Starting…</div>
    </div>
    <div class="stack-row">
      <div class="stack-name">Gizzi Runtime</div>
      <div class="stack-value" id="svc-gizzi">Starting…</div>
    </div>
    <div class="stack-row">
      <div class="stack-name">Platform UI</div>
      <div class="stack-value" id="svc-platform">Waiting…</div>
    </div>
  </div>
  
  <div id="loading">
    <div class="spinner"></div>
    <div class="status" id="status">Starting...</div>
    <div class="progress-container">
      <div class="progress-bar" id="progress-bar"></div>
    </div>
    <div class="progress-text" id="progress-text"></div>
  </div>

  <div id="auth" class="auth-container">
    <div id="auth-copy" style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 24px; text-align: center; line-height: 1.5;">
      Waiting for the local backend stack to come online.
    </div>
    <div id="auth-error" style="display:none; font-size: 12px; color: #e8886a; margin-bottom: 12px; text-align: center;"></div>
    <button class="btn-login" id="btn-login" onclick="login()" disabled style="opacity:0.5;cursor:not-allowed;">Sign In</button>
    <button class="btn-quit" onclick="quit()">Quit</button>
  </div>

  <div id="waiting" style="display:none; flex-direction: column; align-items: center; width: 100%;">
    <div class="spinner"></div>
    <div id="waiting-status" style="font-size: 14px; color: #a0a0b0; text-align: center; margin-top: 12px;">Waiting for browser login...</div>
  </div>
  
  <div class="version">v${PLATFORM_MANIFEST.version}</div>
  
  <script>
    window.splashStartTime = Date.now();
    const { ipcRenderer } = require('electron');
    
    function login() {
      const btn = document.getElementById('btn-login');
      if (btn && btn.disabled) return;
      ipcRenderer.send('auth:start-login');
    }

    function quit() {
      ipcRenderer.send('app:quit');
    }

    function setStackStatusVisible(visible) {
      const stack = document.querySelector('.stack-status');
      if (!stack) return;
      if (visible) {
        stack.classList.remove('hidden');
      } else {
        stack.classList.add('hidden');
      }
    }

    ipcRenderer.on('status', (_, message) => {
      document.getElementById('status').textContent = message;
    });

    ipcRenderer.on('services', (_, services) => {
      const entries = [
        ['api', 'svc-api'],
        ['gateway', 'svc-gateway'],
        ['gizzi', 'svc-gizzi'],
        ['platform', 'svc-platform'],
      ];

      let allHealthy = true;
      for (const [key, nodeId] of entries) {
        const node = document.getElementById(nodeId);
        const state = services?.[key];
        if (!node || !state) {
          allHealthy = false;
          continue;
        }

        node.textContent = state.detail || state.status;
        node.className = 'stack-value ' + (state.status === 'up' ? 'up' : state.status === 'down' ? 'down' : '');
        if (state.status !== 'up') {
          allHealthy = false;
        }
      }

      const authCopy = document.getElementById('auth-copy');
      const loginButton = document.getElementById('btn-login');
      if (authCopy) {
        authCopy.textContent = allHealthy
          ? 'Local backend connected. Continue with desktop sign-in.'
          : 'Waiting for the local backend stack to come online.';
      }
      if (loginButton) {
        loginButton.disabled = !allHealthy;
        loginButton.style.opacity = allHealthy ? '1' : '0.5';
        loginButton.style.cursor = allHealthy ? 'pointer' : 'not-allowed';
      }

      setStackStatusVisible(!allHealthy);
    });

    ipcRenderer.on('auth-required', () => {
      // Show 'Authenticating...' briefly so the user sees startup progress
      // before the login prompt appears
      const showAuth = () => {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('waiting').style.display = 'none';
        document.getElementById('auth').style.display = 'flex';
        setStackStatusVisible(false);
      };
      const elapsed = Date.now() - window.splashStartTime;
      const minDelay = 1200;
      if (elapsed >= minDelay) {
        showAuth();
      } else {
        setTimeout(showAuth, minDelay - elapsed);
      }
    });

    ipcRenderer.on('auth:login-started', (_, message) => {
      document.getElementById('auth').style.display = 'none';
      const waiting = document.getElementById('waiting');
      waiting.style.display = 'flex';
      document.getElementById('waiting-status').textContent = message;
      setStackStatusVisible(false);
    });

    ipcRenderer.on('auth:login-success', (_, message) => {
      const waiting = document.getElementById('waiting');
      waiting.innerHTML = '<div style="font-size:14px;color:#7ec699;text-align:center;">' + message + '</div>';
    });

    ipcRenderer.on('auth:login-failed', (_, message) => {
      const waiting = document.getElementById('waiting');
      waiting.style.display = 'none';
      document.getElementById('auth').style.display = 'flex';
      document.getElementById('auth-error').textContent = message;
      document.getElementById('auth-error').style.display = 'block';
      setStackStatusVisible(false);
    });
    
    ipcRenderer.on('progress', (_, percent) => {
      document.getElementById('progress-bar').style.width = percent + '%';
      document.getElementById('progress-text').textContent = percent > 0 ? percent + '%' : '';
    });
    
    ipcRenderer.on('complete', () => {
      document.getElementById('loading').innerHTML = 
        '<div style="font-size: 24px; margin-bottom: 8px; color: #D4B08C;">✓</div><div style="color: #D4B08C;">Local backend connected</div>';
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
function createMainWindow() {
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
    window.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
        const accessToken = authManager.getAccessToken();
        if (accessToken &&
            /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\//.test(details.url)) {
            details.requestHeaders.Authorization = `Bearer ${accessToken}`;
            details.requestHeaders['X-Allternit-Desktop-Access-Token'] = accessToken;
        }
        callback({ requestHeaders: details.requestHeaders });
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
    // Auto-open DevTools only when flag is set
    if (featureFlagManager.get('devtools.auto-open')) {
        window.webContents.openDevTools({ mode: 'detach' });
    }
    // Log console messages
    window.webContents.on('console-message', (event, level, message, line, sourceId) => {
        log.info(`[Renderer] ${message} (${sourceId}:${line})`);
    });
    return window;
}
// ============================================================================
// App Initialization (Unified Flow)
// ============================================================================
async function initializeApp() {
    log.info('[Main] Initializing Allternit Desktop v' + PLATFORM_MANIFEST.version);
    const backendConfig = store.get('backend');
    // Determine which mode to use
    if (backendConfig.mode === 'development') {
        // Development mode - connect to localhost:4096
        await initializeDevelopmentMode();
    }
    else if (backendConfig.mode === 'remote' && backendConfig.remoteUrl) {
        // Remote mode - connect to user VPS
        await initializeRemoteMode(backendConfig.remoteUrl);
    }
    else {
        // Bundled mode - manage local backend
        await initializeBundledMode();
    }
}
async function initializeBundledMode() {
    log.info('[Main] Bundled mode - managing local backend');
    // Show splash
    splashWindow = createSplashWindow();
    const updateSplash = (status, progress) => {
        splashWindow?.webContents.send('status', status);
        if (progress !== undefined) {
            splashWindow?.webContents.send('progress', progress);
        }
    };
    const serviceState = {
        api: { status: 'pending', detail: 'Starting…' },
        gateway: { status: 'pending', detail: 'Starting…' },
        gizzi: { status: 'pending', detail: 'Starting…' },
        platform: { status: 'pending', detail: 'Waiting…' },
    };
    const pushServiceState = () => {
        splashWindow?.webContents.send('services', serviceState);
    };
    pushServiceState();
    try {
        log.info('[Main] Starting initialization sequence...');
        // Step 1 — gizzi-code (AI runtime, port 4096)
        // All agent sessions, conversations, tool calls and provider routing go through here.
        updateSplash('Starting AI runtime…', 10);
        let gizziUrl = null;
        try {
            gizziUrl = await gizziManager.start();
            activeBackendUrl = gizziUrl;
            persistedSidecarConfig = {
                apiUrl: gizziUrl,
                password: gizziManager.getPassword(),
                port: new URL(gizziUrl).port ? Number(new URL(gizziUrl).port) : 4096,
            };
            log.info('[Main] Gizzi-code started successfully');
            serviceState.gizzi = { status: 'up', detail: `Connected on ${gizziUrl}` };
            pushServiceState();
        }
        catch (gizziErr) {
            log.warn('[Main] Gizzi-code failed to start, continuing without AI runtime:', gizziErr);
            serviceState.gizzi = { status: 'down', detail: 'Failed to start on 4096' };
            pushServiceState();
            updateSplash('AI runtime unavailable, continuing…', 15);
            await new Promise(r => setTimeout(r, 1000));
        }
        // Step 2 — allternit-api (Rust operator API, port 8013 — VM, rails, terminal)
        const apiStatus = await backendManager.getStatus();
        if (!apiStatus.installed) {
            updateSplash('Setting up Allternit for the first time…', 25);
        }
        else if (apiStatus.version && shouldUpdateBackend(apiStatus.version)) {
            updateSplash('Updating Allternit…', 25);
        }
        else {
            updateSplash('Starting operator backend…', 30);
        }
        const apiUrl = await backendManager.ensureBackend({
            gizziUrl,
            gizziPassword: gizziManager.getPassword(),
            gizziUsername: 'gizzi',
        });
        serviceState.api = { status: 'up', detail: 'Connected on http://127.0.0.1:3004' };
        serviceState.gateway = { status: 'up', detail: 'Connected on http://127.0.0.1:8013' };
        pushServiceState();
        store.set('backend.lastLocalVersion', PLATFORM_MANIFEST.backend.version);
        updateSplash('Starting platform UI…', 60);
        // Step 3 — Next.js standalone platform server
        // In dev, the Next.js dev server runs separately on port 3013.
        // In production, the standalone server is bundled in resources/platform-server/.
        let platformUrl;
        if (isDev) {
            platformUrl = 'http://localhost:3013';
            // Write gizzi credentials to a session file so the external dev server can read them.
            // The dev server can't receive env injection from Electron, so this file bridges the gap.
            const sessionFile = path.join(os.homedir(), '.allternit', 'gizzi-dev-session.json');
            try {
                await fs.promises.mkdir(path.dirname(sessionFile), { recursive: true });
                await fs.promises.writeFile(sessionFile, JSON.stringify({
                    gizziUrl: gizziUrl ?? 'http://127.0.0.1:4096',
                    gizziPassword: gizziManager.getPassword() ?? '',
                    writtenAt: Date.now(),
                }), 'utf8');
                log.info(`[Main] Wrote gizzi dev session credentials to ${sessionFile}`);
            }
            catch (err) {
                log.warn('[Main] Failed to write gizzi dev session file:', err);
            }
            serviceState.platform = { status: 'up', detail: `Connected on ${platformUrl}` };
            pushServiceState();
        }
        else {
            platformUrl = await platformServerManager.start({
                apiUrl,
                // API key generated per-session by backendManager
                apiKey: backendManager.getApiKey() ?? '',
                // gizzi-code credentials — password generated per-session by gizziManager
                gizziUrl: gizziUrl ?? '',
                gizziPassword: gizziManager.getPassword() ?? '',
            });
            log.info(`[Main] Platform server returned URL: ${platformUrl}`);
            serviceState.platform = { status: 'up', detail: `Connected on ${platformUrl}` };
            pushServiceState();
        }
        activePlatformUrl = platformUrl;
        process.env.ALLTERNIT_OAUTH_BASE_URL = platformUrl;
        log.info(`[Main] Desktop OAuth authority set to ${platformUrl}`);
        if (process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK !== '1') {
            console.log('[Main] Ensuring user is authenticated...');
            updateSplash('Authenticating…', 75);
            await authManager.ensureAuthenticated(splashWindow);
        }
        else {
            log.info('[Main] Auth bypassed via ALLTERNIT_PLATFORM_DISABLE_CLERK=1');
        }
        // Complete
        splashWindow?.webContents.send('complete');
        await new Promise(r => setTimeout(r, 400));
        splashWindow?.close();
        splashWindow = null;
        mainWindow = createMainWindow();
        log.info(`[Main] Loading platform URL: ${platformUrl}`);
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
        mainWindow.loadURL(platformUrl);
        // First launch: used for permission onboarding gating below
        const isFirstLaunch = !store.get('onboardingComplete');
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
        // ── First-launch: macOS permission onboarding ─────────────────────────
        // Desktop automation requires Accessibility and Screen Recording.
        // On macOS, guide the user through granting these permissions.
        // The renderer signals readiness via permissionGuide.readyForCheck() when
        // its onboarding wizard reaches the permissions step. We also set a
        // fallback timeout so old platform versions still get guided.
        if (isFirstLaunch) {
            mainWindow.webContents.once('did-finish-load', async () => {
                if (!store.get('permissions').promptedDuringOnboarding) {
                    let onboardingStarted = false;
                    const startPermissionOnboarding = async () => {
                        if (onboardingStarted)
                            return;
                        onboardingStarted = true;
                        try {
                            const result = await runPermissionOnboarding((status) => {
                                mainWindow?.webContents.send('permission-guide:status', status);
                            });
                            store.set('permissions.promptedDuringOnboarding', true);
                            store.set('permissions.lastStatus', {
                                accessibility: result.accessibility,
                                screenRecording: result.screenRecording,
                                checkedAt: new Date().toISOString(),
                            });
                        }
                        catch (err) {
                            log.error('[Main] Permission onboarding failed:', err);
                        }
                    };
                    // Fallback: if the renderer never signals ready, start after 8s.
                    setTimeout(() => startPermissionOnboarding(), 8000);
                    // Register a one-shot resolver so the global permission-guide:ready-for-check
                    // handler can trigger the onboarding flow when the renderer explicitly
                    // signals it has reached the permissions step.
                    permissionOnboardingResolver = () => {
                        startPermissionOnboarding();
                    };
                }
            });
        }
    }
    catch (error) {
        log.error('[Main] Failed to initialize bundled mode:', error);
        splashWindow?.webContents.send('error', error.message);
        dialog.showErrorBox('Allternit Initialization Error', `Failed to start Allternit Backend:\n${error.message}\n\nPlease try again or contact support.`);
        app.quit();
    }
}
async function initializeRemoteMode(remoteUrl) {
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
        const versionData = await versionResponse.json();
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
            }
            else if (result.response === 2) {
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
    }
    catch (error) {
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
        }
        else if (result.response === 1) {
            store.set('backend.mode', 'bundled');
            await initializeBundledMode();
        }
        else {
            app.quit();
        }
    }
}
async function initializeDevelopmentMode() {
    log.info('[Main] Development mode');
    activeBackendUrl = 'http://localhost:3013';
    mainWindow = createMainWindow();
    mainWindow.loadURL('http://localhost:3013');
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
function startExtensionBridge() {
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
                if (!line.trim())
                    continue;
                try {
                    const message = JSON.parse(line);
                    mainWindow?.webContents.send('extension:message', message);
                }
                catch {
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
// Quick Chat Mini-Window (Cmd+Shift+A)
// ============================================================================
function createMiniWindow() {
    const { workArea } = screen.getPrimaryDisplay();
    const x = Math.round(workArea.x + (workArea.width - MINI_WINDOW_WIDTH) / 2);
    const y = Math.round(workArea.y + (workArea.height - MINI_WINDOW_HEIGHT) / 2);
    const win = new BrowserWindow({
        width: MINI_WINDOW_WIDTH,
        height: MINI_WINDOW_HEIGHT,
        x,
        y,
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
        ...(isMac ? { vibrancy: 'under-window', visualEffectState: 'active' } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        ...(isMac ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: -100, y: -100 },
            roundedCorners: true,
        } : {}),
    });
    const platformUrl = isDev
        ? 'http://localhost:3013/?mini=1'
        : `${activePlatformUrl}/?mini=1`;
    win.loadURL(platformUrl);
    win.on('blur', () => {
        if (!win.webContents.isDevToolsFocused())
            win.hide();
    });
    win.on('close', (e) => {
        e.preventDefault();
        win.hide();
    });
    return win;
}
function toggleMiniWindow() {
    if (!miniWindow || miniWindow.isDestroyed()) {
        miniWindow = createMiniWindow();
        miniWindow.once('ready-to-show', () => {
            miniWindow?.show();
            miniWindow?.focus();
        });
        return;
    }
    if (miniWindow.isVisible() && miniWindow.isFocused()) {
        miniWindow.hide();
    }
    else {
        miniWindow.show();
        miniWindow.focus();
    }
}
// ============================================================================
// Tray
// ============================================================================
function createTray() {
    const iconPath = join(__dirname, '../../build/tray-icon.png');
    if (!fs.existsSync(iconPath))
        return;
    tray = new Tray(iconPath);
    tray.setToolTip('Allternit');
    // In menu bar mode, single-click toggles window visibility
    tray.on('click', () => {
        const prefs = persistedState.get('prefs');
        if (prefs.menuBarMode) {
            if (mainWindow?.isVisible()) {
                mainWindow.hide();
            }
            else {
                mainWindow?.show();
                mainWindow?.focus();
            }
        }
    });
    updateTrayMenu();
}
async function updateTrayMenu() {
    if (!tray)
        return;
    const backend = store.get('backend');
    const status = await backendManager.getStatus();
    const statusIcon = status.running ? '🟢' : '🔴';
    const modeLabel = backend.mode === 'bundled' ? 'Local' :
        backend.mode === 'remote' ? 'VPS' : 'Dev';
    // Desktop permission status for tray indicator
    let permItem;
    const perm = store.get('permissions')?.lastStatus;
    const hasIssue = perm && (perm.accessibility === 'denied' || perm.screenRecording === 'denied');
    const allOk = perm && perm.accessibility !== 'denied' && perm.screenRecording !== 'denied';
    permItem = {
        label: hasIssue ? '⚠️ Check Permissions' : allOk ? '✅ Permissions OK' : '🔍 Check Permissions',
        click: async () => {
            mainWindow?.show();
            const status = await checkPermissions();
            store.set('permissions.lastStatus', { ...status, checkedAt: new Date().toISOString() });
            mainWindow?.webContents.send('permission-guide:status', status);
            if (status.accessibility === 'denied') {
                await presentGuide('accessibility');
            }
            else if (status.screenRecording === 'denied') {
                await presentGuide('screen-recording');
            }
        },
    };
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
        ...(permItem ? [permItem, { type: 'separator' }] : []),
        { label: 'Show Window', click: () => mainWindow?.show() },
        { label: 'Quick Chat', accelerator: QUICK_CHAT_HOTKEY, click: () => toggleMiniWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() },
    ]);
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
function extractProtocolUrl(argv) {
    return argv.find((value) => value.startsWith('allternit://')) ?? null;
}
function registerProtocolHandler() {
    const success = process.defaultApp
        ? app.setAsDefaultProtocolClient('allternit', process.execPath, [process.argv[1]])
        : app.setAsDefaultProtocolClient('allternit');
    log.info('[Main] Protocol handler registration attempted', {
        success,
        isDefaultProtocolClient: app.isDefaultProtocolClient('allternit'),
        defaultApp: process.defaultApp,
        execPath: process.execPath,
        argv1: process.argv[1] ?? null,
    });
    if (process.defaultApp) {
        return;
    }
}
// Register protocol handler as early as possible (before ready)
registerProtocolHandler();
async function handleProtocolCallback(url) {
    log.info('[Main] handleProtocolCallback triggered with URL:', url);
    if (!url) {
        log.info('[Main] handleProtocolCallback: No URL provided');
        return;
    }
    try {
        const handled = await authManager.handleCallbackUrl(url);
        log.info('[Main] handleCallbackUrl result:', handled);
        if (handled && mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    }
    catch (error) {
        log.error('[Main] Failed to handle auth callback URL:', error);
        dialog.showErrorBox('Authentication Error', error.message);
    }
}
app.on('open-url', (event, url) => {
    log.info('[Main] app.on("open-url") fired with URL:', url);
    event.preventDefault();
    void handleProtocolCallback(url);
});
app.on('second-instance', (_event, argv) => {
    const url = extractProtocolUrl(argv);
    log.info('[Main] app.on("second-instance") fired with URL:', url);
    void handleProtocolCallback(url);
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
app.whenReady().then(async () => {
    console.log('[Main] App is ready...');
    console.log('[Main] Initializing auth manager...');
    await authManager.initialize();
    const startupBackend = store.get('backend');
    void authManager.updateBackendProfile({
        mode: startupBackend.mode,
        remoteUrl: startupBackend.remoteUrl,
    });
    // NOTE: Auth check moved into initializeBundledMode so splash screen can show first
    console.log('[Main] Handling protocol callback if present...');
    void handleProtocolCallback(extractProtocolUrl(process.argv));
    console.log('[Main] Initializing foundation systems...');
    // Initialize foundation systems before everything else
    featureFlagManager.initialize();
    // Push flag changes to all renderer windows
    featureFlagManager.onChange((key, value) => {
        BrowserWindow.getAllWindows().forEach(w => {
            if (!w.isDestroyed())
                w.webContents.send('featureFlags:changed', { key, value });
        });
    });
    // Apply startup-on-login from persisted prefs
    const prefs = persistedState.get('prefs');
    if (isMac) {
        app.setLoginItemSettings({ openAtLogin: prefs.startupOnLogin });
        if (prefs.menuBarMode)
            app.dock?.hide();
    }
    // Initialize MCP host if enabled
    if (featureFlagManager.get('mcp.enabled')) {
        mcpHostManager.initialize();
    }
    // Initialize worker bus if enabled
    if (featureFlagManager.get('workers.enabled')) {
        const workerBase = new URL('../main/workers/', import.meta.url);
        workerBus.register('sqlite', new URL('sqlite-worker.js', workerBase), {
            dbPath: join(app.getPath('userData'), 'allternit.db'),
        });
        workerBus.register('search', new URL('transcript-search-worker.js', workerBase), {
            transcriptDir: join(app.getPath('userData'), 'transcripts'),
        });
        workerBus.register('shell-path', new URL('shell-path-worker.js', workerBase));
    }
    initializeApp();
    createTray();
    startExtensionBridge();
    // Global hotkey: Cmd+Shift+A → Quick Chat floating window
    const hotkeyRegistered = globalShortcut.register(QUICK_CHAT_HOTKEY, toggleMiniWindow);
    if (!hotkeyRegistered) {
        log.warn(`[Main] Failed to register global hotkey: ${QUICK_CHAT_HOTKEY}`);
    }
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            initializeApp();
        }
        else {
            mainWindow?.show();
        }
    });
    // Refresh tray every 10s
    setInterval(updateTrayMenu, 10000);
    // ── Permission re-check on app activation ────────────────────────────────
    // macOS users can revoke permissions in System Settings at any time.
    // Silently re-check when the app becomes active and push updates to renderer.
    app.on('did-become-active', async () => {
        if (!mainWindow || mainWindow.isDestroyed())
            return;
        const status = await checkPermissions();
        const last = store.get('permissions')?.lastStatus;
        const changed = !last || last.accessibility !== status.accessibility || last.screenRecording !== status.screenRecording;
        if (changed) {
            store.set('permissions.lastStatus', { ...status, checkedAt: new Date().toISOString() });
            mainWindow.webContents.send('permission-guide:status', status);
            log.info('[Main] Permission status changed on activation:', status);
        }
    });
}).catch((error) => {
    log.error('[Main] Startup failed:', error);
    if (error instanceof Error && error.message === 'Authentication cancelled') {
        app.quit();
        return;
    }
    dialog.showErrorBox('Allternit Startup Error', error instanceof Error ? error.message : 'Unknown startup failure');
    app.quit();
});
app.on('window-all-closed', () => {
    if (!isMac)
        app.quit();
});
app.on('before-quit', async () => {
    globalShortcut.unregisterAll();
    persistedSidecarConfig = null;
    persistedState.flush();
    featureFlagManager.destroy();
    mcpHostManager.shutdown();
    await workerBus.shutdown();
    tunnelManager.stop();
    await backendManager.stopBackend();
    platformServerManager.stop();
    gizziManager.stop();
    // Remove dev session credentials file so stale credentials don't persist across restarts
    if (isDev) {
        const sessionFile = path.join(os.homedir(), '.allternit', 'gizzi-dev-session.json');
        fs.promises.unlink(sessionFile).catch(() => { });
    }
    // Ensure any floating permission-guide overlay is torn down before quit
    dismissGuide();
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
ipcMain.handle('store:get', (_event, key) => store.get(key));
ipcMain.handle('store:set', (_event, key, value) => {
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
ipcMain.handle('shell:open-external', (_event, url) => {
    shell.openExternal(url);
});
// Desktop auth
ipcMain.handle('auth:get-session', async () => {
    const session = await authManager.getSession();
    if (!session) {
        return null;
    }
    return {
        userId: session.userId,
        userEmail: session.userEmail,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
    };
});
ipcMain.handle('auth:list-accounts', async () => authManager.listAccounts());
ipcMain.handle('auth:forget-account', async (_event, userId) => {
    await authManager.forgetAccount(userId);
});
ipcMain.handle('auth:sign-out', async () => {
    await authManager.signOut();
    app.relaunch();
    app.quit();
});
// ============================================================================
// IPC: Window Controls
// ============================================================================
ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
ipcMain.handle('window:maximize', () => {
    if (!mainWindow)
        return { maximized: false };
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
        return { maximized: false };
    }
    mainWindow.maximize();
    return { maximized: true };
});
ipcMain.handle('window:close', () => { mainWindow?.close(); });
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('window:fullscreen', (_event, enabled) => {
    if (!mainWindow)
        return { fullscreen: false };
    const next = enabled !== undefined ? enabled : !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return { fullscreen: next };
});
ipcMain.handle('window:set-always-on-top', (_event, enabled) => {
    mainWindow?.setAlwaysOnTop(enabled);
});
ipcMain.handle('window:get-state', () => {
    if (!mainWindow)
        return null;
    return {
        maximized: mainWindow.isMaximized(),
        minimized: mainWindow.isMinimized(),
        fullscreen: mainWindow.isFullScreen(),
        focused: mainWindow.isFocused(),
        bounds: mainWindow.getBounds(),
    };
});
ipcMain.handle('window:get-bounds', () => mainWindow?.getBounds());
ipcMain.handle('window:set-bounds', (_event, bounds) => {
    if (mainWindow && bounds) {
        mainWindow.setBounds({ ...mainWindow.getBounds(), ...bounds });
    }
});
ipcMain.handle('window:center', () => { mainWindow?.center(); });
ipcMain.handle('window:hide', () => { mainWindow?.hide(); });
ipcMain.handle('window:show', () => { mainWindow?.show(); });
ipcMain.handle('window:minimize-to-tray', () => { mainWindow?.hide(); });
ipcMain.on('mini-window:hide', () => { miniWindow?.hide(); });
ipcMain.on('mini-window:toggle', () => toggleMiniWindow());
// ============================================================================
// IPC: Theme
// ============================================================================
ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
ipcMain.handle('theme:set', (_event, theme) => {
    nativeTheme.themeSource = theme;
    store.set('theme', theme);
});
// Push theme changes to all renderer windows
nativeTheme.on('updated', () => {
    const isDark = nativeTheme.shouldUseDarkColors;
    BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed())
            w.webContents.send('theme:updated', isDark);
    });
});
// ============================================================================
// IPC: Dialogs
// ============================================================================
ipcMain.handle('dialog:show-save', async (_event, options) => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (!win)
        return { canceled: true };
    return dialog.showSaveDialog(win, options ?? {});
});
ipcMain.handle('dialog:show-open', async (_event, options) => {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (!win)
        return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(win, options ?? {});
});
// ============================================================================
// IPC: Sidecar — gizzi-code AI runtime (port 4096)
// The platform uses window.allternitSidecar to discover the backend URL.
// ============================================================================
ipcMain.handle('sidecar:get-status', async () => {
    if (!gizziManager.isRunning())
        return 'stopped';
    try {
        const res = await fetch(`${gizziManager.getUrl()}/api/app/health`, {
            signal: AbortSignal.timeout(1000),
        });
        return res.ok || res.status === 401 || res.status === 404 ? 'running' : 'error';
    }
    catch {
        return 'error';
    }
});
ipcMain.handle('sidecar:get-api-url', () => gizziManager.getUrl());
ipcMain.handle('sidecar:get-auth-password', () => gizziManager.getPassword());
ipcMain.handle('sidecar:get-basic-auth', () => {
    const password = gizziManager.getPassword();
    if (!password)
        return undefined;
    const encoded = Buffer.from(`gizzi:${password}`).toString('base64');
    return { username: 'gizzi', password, header: `Basic ${encoded}` };
});
ipcMain.handle('sidecar:get-persisted-config', () => persistedSidecarConfig);
ipcMain.handle('sidecar:clear-persisted-config', () => {
    persistedSidecarConfig = null;
    return true;
});
ipcMain.handle('sidecar:start', async () => {
    try {
        await gizziManager.start();
        return true;
    }
    catch {
        return false;
    }
});
ipcMain.handle('sidecar:stop', () => { gizziManager.stop(); return true; });
ipcMain.handle('sidecar:restart', async () => {
    try {
        gizziManager.stop();
        await gizziManager.start();
        return true;
    }
    catch {
        return false;
    }
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
    }
    catch {
        return { mode: backend.mode, url: activeBackendUrl, status: 'disconnected' };
    }
});
ipcMain.handle('connection:get-backend', () => {
    const backend = store.get('backend');
    return { mode: backend.mode, url: activeBackendUrl };
});
ipcMain.handle('connection:set-backend', (_event, config) => {
    const nextBackend = { ...store.get('backend'), ...config };
    store.set('backend', nextBackend);
    void authManager.updateBackendProfile({
        mode: nextBackend.mode,
        remoteUrl: nextBackend.remoteUrl,
    });
    mainWindow?.webContents.send('connection:state', config);
});
// ============================================================================
// IPC: VM Setup (onboarding)
// VM images are packaged with the app — no download needed.
// Check resources/vm/ for packaged images per platform.
// ============================================================================
import * as path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createVMManager } = require('../../native/vm-manager-node/dist/index.js');
// VM Manager instance - created on demand
let vmManager = null;
/** Get host architecture mapped to VM image architecture naming */
function getVmArch() {
    const arch = process.arch;
    if (arch === 'x64')
        return 'amd64';
    if (arch === 'arm64')
        return 'arm64';
    return arch;
}
/** Get VM images directory - supports both packaged and dev paths */
function getVmImagesPath() {
    const arch = getVmArch();
    // Packaged app: resources/vm/${platform}/
    const packagedPath = path.join(process.resourcesPath ?? '', 'vm');
    if (fs.existsSync(packagedPath)) {
        const files = fs.readdirSync(packagedPath);
        const hasVmFiles = files.some(f => f.endsWith('.raw') || f.endsWith('.qcow2') || f.endsWith('.vhd') ||
            f.endsWith('.ipsw') || f === 'kernel' || f === 'rootfs.ext4' ||
            f.endsWith('.ext4') || f.startsWith('vmlinux') || f.startsWith('initrd'));
        if (hasVmFiles)
            return packagedPath;
    }
    // Dev: Check ~/.allternit/vm-images/
    const home = app.getPath('home');
    const devPath = path.join(home, '.allternit/vm-images');
    if (fs.existsSync(devPath)) {
        const files = fs.readdirSync(devPath);
        const hasVmFiles = files.some(f => f.startsWith('vmlinux') || f.startsWith('initrd') || f.endsWith('.ext4'));
        if (hasVmFiles)
            return devPath;
    }
    return null;
}
/** Get paths to individual VM image files */
function getVmImagePaths() {
    const imagesPath = getVmImagesPath();
    if (!imagesPath)
        return null;
    const arch = getVmArch();
    const archSuffix = arch === 'amd64' ? '' : `-${arch}`;
    const files = fs.readdirSync(imagesPath);
    // Discover files dynamically (kernel version is no longer hardcoded)
    const kernel = files.find(f => f.startsWith('vmlinux-') && f.endsWith(`-allternit${archSuffix}`))
        || files.find(f => f.startsWith('vmlinux-') && f.endsWith('-allternit'))
        || files.find(f => f.startsWith('vmlinux') || f === 'kernel');
    const initrd = files.find(f => f.startsWith('initrd.img-') && f.endsWith(`-allternit${archSuffix}`))
        || files.find(f => f.startsWith('initrd.img-') && f.endsWith('-allternit'))
        || files.find(f => f.startsWith('initrd') || f === 'initrd.img');
    const rootfs = files.find(f => f.startsWith('ubuntu-22.04-allternit-') && f.endsWith(`${archSuffix}.ext4`))
        || files.find(f => f.startsWith('ubuntu-22.04-allternit-') && f.endsWith('.ext4'))
        || files.find(f => f.endsWith('.ext4') || f.endsWith('.raw') || f === 'rootfs.ext4');
    if (!kernel || !rootfs)
        return null;
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
    // In dev mode, simulate VM startup if the Swift binary isn't built yet
    if (isDev) {
        const steps = [
            { stage: 'verifying', message: 'Verifying VM images...', progress: 10, delay: 400 },
            { stage: 'booting', message: 'Starting Linux VM...', progress: 40, delay: 600 },
            { stage: 'connecting', message: 'Connecting to VM services...', progress: 80, delay: 500 },
            { stage: 'ready', message: 'VM Ready!', progress: 100, delay: 400 },
        ];
        for (const step of steps) {
            await new Promise(r => setTimeout(r, step.delay));
            event.sender.send('vm-setup:init-progress', step);
        }
        log.info('[VM Setup] VM simulated start (dev mode)');
        return true;
    }
    // Create VM Manager with packaged image paths
    const vmConfig = {
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
        }
        catch {
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
    }
    catch (error) {
        log.error('[VM Setup] Failed to start VM:', error);
        throw new Error(`Failed to start VM: ${error.message}`);
    }
});
ipcMain.handle('vm-setup:get-vm-status', async () => {
    if (!vmManager)
        return 'stopped';
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
    }
    catch {
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
ipcMain.handle('extension:send', (_event, message) => {
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
    }
    catch (error) {
        log.error('[Tunnel] Failed to enable web access:', error);
        return { success: false, error: error.message };
    }
});
// Start tunnel only — no browser redirect. Used by the in-app onboarding wizard
// so it can register the backend directly without opening a system browser tab.
ipcMain.handle('tunnel:start', async () => {
    try {
        const url = await tunnelManager.start();
        const token = tunnelManager.getToken();
        return { success: true, url, token };
    }
    catch (error) {
        log.error('[Tunnel] Failed to start:', error);
        return { success: false, error: error.message };
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
// ============================================================================
// IPC: Permission Guide — macOS permission detection + native overlay
// ============================================================================
ipcMain.handle('permission-guide:check', async () => checkPermissions());
ipcMain.handle('permission-guide:present', async (_event, panel) => presentGuide(panel));
ipcMain.handle('permission-guide:dismiss', () => dismissGuide());
ipcMain.handle('permission-guide:get-status', () => getGuideStatus());
ipcMain.handle('permission-guide:request-check', async () => {
    const status = await checkPermissions();
    store.set('permissions.lastStatus', { ...status, checkedAt: new Date().toISOString() });
    mainWindow?.webContents.send('permission-guide:status', status);
    return status;
});
ipcMain.handle('permission-guide:ready-for-check', async () => {
    // Called by the renderer's onboarding wizard when it reaches the permissions step.
    // This allows the platform UI to control exact timing instead of relying on a fixed delay.
    log.info('[Main] Renderer signaled ready for permission check');
    const status = await checkPermissions();
    store.set('permissions.lastStatus', { ...status, checkedAt: new Date().toISOString() });
    mainWindow?.webContents.send('permission-guide:status', status);
    // If this is the first launch and onboarding hasn't started yet, kick it off now.
    if (permissionOnboardingResolver) {
        const resolver = permissionOnboardingResolver;
        permissionOnboardingResolver = null;
        resolver();
    }
    return status;
});
// ============================================================================
// IPC: Feature Flags
// ============================================================================
ipcMain.handle('featureFlags:get', (_event, key) => key ? featureFlagManager.get(key) : featureFlagManager.getAll());
ipcMain.handle('featureFlags:set', (_event, key, value) => {
    featureFlagManager.set(key, value);
    return true;
});
// ============================================================================
// IPC: Persisted State
// ============================================================================
ipcMain.handle('state:get', (_event, key) => persistedState.get(key));
ipcMain.handle('state:set', (_event, key, value) => {
    persistedState.set(key, value);
    // Push to all renderer windows
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed())
            w.webContents.send('state:changed', { key, value });
    });
    return true;
});
ipcMain.handle('state:patch', (_event, key, partial) => {
    persistedState.patch(key, partial);
    return true;
});
// ============================================================================
// IPC: Find in Page
// ============================================================================
ipcMain.handle('window:find-in-page', (_event, text, options) => {
    if (!mainWindow || !text)
        return;
    mainWindow.webContents.findInPage(text, options);
});
ipcMain.handle('window:find-stop', (_event, keepSelection) => {
    mainWindow?.webContents.stopFindInPage(keepSelection ? 'keepSelection' : 'clearSelection');
});
// Forward find results to renderer
app.whenReady().then(() => {
    // Attach find-in-page result forwarding whenever a new window is created
    app.on('browser-window-created', (_e, win) => {
        win.webContents.on('found-in-page', (_event, result) => {
            win.webContents.send('window:find-result', result);
        });
    });
});
// ============================================================================
// IPC: Locale / i18n
// ============================================================================
ipcMain.handle('locale:get', () => {
    const stored = persistedState.get('prefs').locale;
    return stored ?? app.getLocale();
});
ipcMain.handle('locale:set', (_event, locale) => {
    persistedState.patch('prefs', { locale });
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed())
            w.webContents.send('locale:changed', locale);
    });
    return true;
});
// ============================================================================
// IPC: Menu Bar Mode + Startup on Login
// ============================================================================
ipcMain.handle('menuBar:getMode', () => persistedState.get('prefs').menuBarMode);
ipcMain.handle('menuBar:setMode', (_event, enabled) => {
    persistedState.patch('prefs', { menuBarMode: enabled });
    if (isMac) {
        if (enabled) {
            app.dock?.hide();
        }
        else {
            app.dock?.show();
        }
    }
    mainWindow?.webContents.send('menuBar:modeChanged', enabled);
    return true;
});
ipcMain.handle('startup:getOnLogin', () => persistedState.get('prefs').startupOnLogin);
ipcMain.handle('startup:setOnLogin', (_event, enabled) => {
    persistedState.patch('prefs', { startupOnLogin: enabled });
    if (isMac)
        app.setLoginItemSettings({ openAtLogin: enabled });
    return true;
});
// ============================================================================
// IPC: Context Menu (native right-click for webview)
// ============================================================================
app.whenReady().then(() => {
    app.on('browser-window-created', (_e, win) => {
        win.webContents.on('context-menu', (_event, params) => {
            const menuItems = [];
            if (params.selectionText) {
                menuItems.push({ label: 'Copy', role: 'copy' }, { type: 'separator' });
            }
            if (params.isEditable) {
                menuItems.push({ label: 'Cut', role: 'cut' }, { label: 'Copy', role: 'copy' }, { label: 'Paste', role: 'paste' }, { type: 'separator' }, { label: 'Select All', role: 'selectAll' });
            }
            if (!params.selectionText && !params.isEditable) {
                menuItems.push({ label: 'Back', enabled: win.webContents.canGoBack(), click: () => win.webContents.goBack() }, { label: 'Forward', enabled: win.webContents.canGoForward(), click: () => win.webContents.goForward() }, { label: 'Reload', click: () => win.webContents.reload() });
            }
            if (isDev) {
                menuItems.push({ type: 'separator' }, { label: 'Inspect Element', click: () => win.webContents.inspectElement(params.x, params.y) });
            }
            if (menuItems.length > 0) {
                Menu.buildFromTemplate(menuItems).popup({ window: win });
            }
        });
    });
});
// ============================================================================
// IPC: MCP Host
// ============================================================================
ipcMain.handle('mcp:list-servers', () => mcpHostManager.listServers());
ipcMain.handle('mcp:list-tools', (_event, serverId) => mcpHostManager.listTools(serverId));
ipcMain.handle('mcp:call-tool', async (_event, serverId, toolName, args) => {
    try {
        const result = await mcpHostManager.callTool(serverId, toolName, args);
        return { success: true, result };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
ipcMain.handle('mcp:add-server', async (_event, id, config) => {
    try {
        await mcpHostManager.addServer(id, config);
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
ipcMain.handle('mcp:remove-server', async (_event, id) => {
    try {
        await mcpHostManager.removeServer(id);
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
// ============================================================================
// IPC: Worker Bus
// ============================================================================
ipcMain.handle('worker:send', async (_event, workerName, message) => {
    try {
        const result = await workerBus.send(workerName, message);
        return { success: true, result };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
ipcMain.handle('worker:list', () => ['sqlite', 'search', 'shell-path'].filter(name => workerBus.isAlive(name)));
// ============================================================================
// IPC: HyperFrames — render HTML artifacts as MP4/MOV/WebM video
// Requires: npx hyperframes (install via `npx skills add heygen-com/hyperframes`)
// ============================================================================
ipcMain.handle('hyperframes:check', async () => {
    return new Promise((resolve) => {
        execFile('npx', ['hyperframes', '--version'], { timeout: 5000 }, (err, stdout) => {
            if (err)
                resolve({ available: false });
            else
                resolve({ available: true, version: stdout.trim() });
        });
    });
});
ipcMain.handle('hyperframes:render', async (event, html, options) => {
    const { format = 'mp4', fps = 30, width = 1920, height = 1080 } = options;
    const tmpDir = os.tmpdir();
    const stamp = Date.now();
    const srcFile = join(tmpDir, `allternit-hf-${stamp}.html`);
    const outFile = join(tmpDir, `allternit-hf-${stamp}.${format}`);
    try {
        fs.writeFileSync(srcFile, html, 'utf-8');
        const renderResult = await new Promise((resolve) => {
            const proc = execFile('npx', ['hyperframes', 'render', srcFile,
                '--output', outFile,
                '--fps', String(fps),
                '--width', String(width),
                '--height', String(height),
            ], { timeout: 180_000 }, (err) => {
                if (err)
                    resolve({ success: false, error: err.message });
                else
                    resolve({ success: true });
            });
            proc.stdout?.on('data', (d) => event.sender.send('hyperframes:progress', d.toString().trim()));
            proc.stderr?.on('data', (d) => event.sender.send('hyperframes:progress', d.toString().trim()));
        });
        try {
            fs.unlinkSync(srcFile);
        }
        catch { /* ignore */ }
        if (!renderResult.success)
            return { success: false, error: renderResult.error };
        if (!fs.existsSync(outFile))
            return { success: false, error: 'Render completed but output file not found' };
        // Native save dialog — let user choose where to save
        const win = BrowserWindow.getFocusedWindow();
        const saveResult = await dialog.showSaveDialog(win ?? BrowserWindow.getAllWindows()[0], {
            title: 'Save Video',
            defaultPath: `allternit-video-${stamp}.${format}`,
            filters: [
                { name: 'Video', extensions: [format] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (saveResult.canceled || !saveResult.filePath) {
            try {
                fs.unlinkSync(outFile);
            }
            catch { /* ignore */ }
            return { success: false, error: 'Cancelled' };
        }
        fs.copyFileSync(outFile, saveResult.filePath);
        try {
            fs.unlinkSync(outFile);
        }
        catch { /* ignore */ }
        return { success: true, savedPath: saveResult.filePath };
    }
    catch (err) {
        try {
            fs.unlinkSync(srcFile);
        }
        catch { /* ignore */ }
        try {
            fs.unlinkSync(outFile);
        }
        catch { /* ignore */ }
        return { success: false, error: err.message };
    }
});
//# sourceMappingURL=unified-main.js.map