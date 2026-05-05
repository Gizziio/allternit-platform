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
import * as http from 'node:http';
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
import { notebookManager } from './notebook-manager.js';
import { PLATFORM_MANIFEST, shouldUpdateBackend } from './manifest.js';
import {
  checkPermissions,
  presentGuide,
  dismissGuide,
  getGuideStatus,
  waitForGuideDismissed,
  runPermissionOnboarding,
} from './permission-guide.js';
import { featureFlagManager } from './feature-flags.js';
import { persistedState } from './persisted-state.js';
import { workerBus } from './workers/worker-bus.js';
import { mcpHostManager } from './mcp-host-manager.js';
import { isLimaInstalled, installLima, startVM, stopVM, getVMStatus } from './lima.js';

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

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activePlatformUrl: string = isDev ? 'http://localhost:3013' : 'http://127.0.0.1:3100';

const QUICK_CHAT_HOTKEY = 'CommandOrControl+Shift+A';
const MINI_WINDOW_WIDTH = 520;
const MINI_WINDOW_HEIGHT = 600;
/** Resolved backend URL — set once the app initializes. Used by sdk:get-backend-url IPC. */
let activeBackendUrl: string = 'http://localhost:8013';
/** Active TCP connection from the native messaging host (Chrome extension bridge) */
let extensionSocket: net.Socket | null = null;
/** In-session sidecar config — set after gizziManager starts, cleared on stop. */
let persistedSidecarConfig: { apiUrl: string; password: string; port: number } | null = null;
/** If set, the permission onboarding flow should start when the renderer signals readiness. */
let permissionOnboardingResolver: (() => void) | null = null;

interface StoreSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number };
  theme: 'light' | 'dark' | 'system';
  backend: {
    mode: 'bundled' | 'remote' | 'development';
    remoteUrl?: string;
    lastLocalVersion?: string;
  };
  onboardingComplete: boolean;
  permissions: {
    /** Whether the user has been shown the permission guide during onboarding */
    promptedDuringOnboarding: boolean;
    /** Last known permission status (cached for quick checks) */
    lastStatus?: {
      accessibility: 'granted' | 'denied' | 'unknown' | 'not-applicable';
      screenRecording: 'granted' | 'denied' | 'unknown' | 'not-applicable';
      checkedAt: string;
    };
  };
}

const store = new Store<StoreSchema>({
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

function createSplashWindow(): BrowserWindow {
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

  // Log splash window console messages
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log.info(`[Splash] ${message} (${sourceId}:${line})`);
  });

  // Inline splash HTML - Allternit branded
  const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      font-family: 'Allternit Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
      font-size: 12px;
      line-height: 1.2;
      white-space: pre;
      color: #D4B08C;
      margin-bottom: 20px;
      text-align: center;
    }
    .brand {
      width: 100%;
      max-width: 392px;
      font-size: clamp(26px, 6.4vw, 31px);
      font-weight: 700;
      color: #D4B08C;
      font-family: 'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif;
      margin-bottom: 8px;
      letter-spacing: 1.4px;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
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
  <div class="brand">ALLTERNIT DESKTOP</div>
  <div class="tagline">Starting…</div>

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
        
        // Critical services that MUST be up for the app to function
        const isCritical = key === 'api' || key === 'gateway' || key === 'platform';
        if (isCritical && state.status !== 'up') {
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
    title: 'Allternit Desktop',
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
    if (
      accessToken &&
      /^http:\/\/(?:127\.0\.0\.1|localhost):\d+\//.test(details.url)
    ) {
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
  if (featureFlagManager.get<boolean>('devtools.auto-open')) {
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
  const serviceState = {
    api: { status: 'pending', detail: 'Starting…' },
    gateway: { status: 'pending', detail: 'Starting…' },
    gizzi: { status: 'pending', detail: 'Starting…' },
    platform: { status: 'pending', detail: 'Waiting…' },
    research: { status: 'pending', detail: 'Waiting…' },
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
    let gizziUrl: string | null = null;
    try {
      gizziUrl = await gizziManager.start();
      activeBackendUrl = gizziUrl;
      persistedSidecarConfig = {
        apiUrl: gizziUrl,
        password: gizziManager.getPassword()!,
        port: new URL(gizziUrl).port ? Number(new URL(gizziUrl).port) : 4096,
      };
      log.info('[Main] Gizzi-code started successfully');
      serviceState.gizzi = { status: 'up', detail: `Connected on ${gizziUrl}` };
      pushServiceState();
    } catch (gizziErr) {
      log.warn('[Main] Gizzi-code failed to start, continuing without AI runtime:', gizziErr);
      serviceState.gizzi = { status: 'down', detail: 'Failed to start on 4096' };
      pushServiceState();
      updateSplash('AI runtime unavailable, continuing…', 15);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Step 2 — allternit-api (Rust operator API, port 8013 — VM, rails, terminal)
    const apiStatus = await backendManager.getStatus();
    if (!apiStatus.installed) {
      updateSplash('Setting up Allternit Desktop for the first time…', 25);
    } else if (apiStatus.version && shouldUpdateBackend(apiStatus.version)) {
      updateSplash('Updating Allternit Desktop…', 25);
    } else {
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
    let platformUrl: string;
    if (isDev) {
      platformUrl = 'http://localhost:3013';
      // Write gizzi credentials to a session file so the external dev server can read them.
      // The dev server can't receive env injection from Electron, so this file bridges the gap.
      const sessionFile = join(os.homedir(), '.allternit', 'gizzi-dev-session.json');
      try {
        await fs.promises.mkdir(dirname(sessionFile), { recursive: true });
        await fs.promises.writeFile(sessionFile, JSON.stringify({
          gizziUrl: gizziUrl ?? 'http://127.0.0.1:4096',
          gizziPassword: gizziManager.getPassword() ?? '',
          writtenAt: Date.now(),
        }), 'utf8');
        log.info(`[Main] Wrote gizzi dev session credentials to ${sessionFile}`);
      } catch (err) {
        log.warn('[Main] Failed to write gizzi dev session file:', err);
      }
      serviceState.platform = { status: 'up', detail: `Connected on ${platformUrl}` };
      pushServiceState();
    } else {
      platformUrl = await platformServerManager.start({
        apiUrl,
        // API key generated per-session by backendManager
        apiKey: backendManager.getApiKey() ?? '',
        // gizzi-code credentials — password generated per-session by gizziManager
        gizziUrl: gizziUrl || undefined,
        gizziPassword: gizziManager.getPassword() || undefined,
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
    } else {
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
            if (onboardingStarted) return;
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
            } catch (err) {
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

    // ── Service Watchdog: Maintain backend health ──────────────────────────
    setInterval(async () => {
      try {
        const status = await backendManager.getStatus();
        if (!status.running) {
          log.warn('[Watchdog] Backend services found stopped, attempting auto-recovery...');
          await backendManager.ensureBackend();
        }
      } catch (err) {
        log.error('[Watchdog] Health check failed:', err);
      }
    }, 30_000);
    
  } catch (error) {
    log.error('[Main] Failed to initialize bundled mode:', error);
    splashWindow?.webContents.send('error', (error as Error).message);
    
    dialog.showErrorBox(
      'Allternit Desktop Initialization Error',
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
        title: 'Allternit Desktop Backend Update Required',
        message: `Your remote backend (${version}) needs to be updated to match Allternit Desktop ${PLATFORM_MANIFEST.backend.version}.`,
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

/**
 * Pending HTTP relay requests waiting for a response from the extension.
 * Key = message id sent to the extension; value = resolver function.
 */
const pendingRelayResponses = new Map<string, (data: unknown) => void>();

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
          const message = JSON.parse(line) as Record<string, unknown>;
          // Forward to renderer
          mainWindow?.webContents.send('extension:message', message);
          // Resolve any pending ACU relay request waiting on this id
          const id = message['id'] as string | undefined;
          if (id && pendingRelayResponses.has(id)) {
            pendingRelayResponses.get(id)!(message);
            pendingRelayResponses.delete(id);
          }
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
// ACU Extension Relay — HTTP endpoint for the Computer-Use engine
//
// ACU (Python, port 8760) cannot connect to TCP 3011 directly because that
// port is owned exclusively by this process as a server for the native host.
// Instead ACU POSTs to http://127.0.0.1:3012/extension/send and this handler
// forwards the message onto the extension socket.
//
// Port: ACU_EXTENSION_RELAY_PORT env var, default 3012
// ============================================================================

const ACU_RELAY_PORT = parseInt(process.env['ACU_EXTENSION_RELAY_PORT'] ?? '3012', 10);

function startAcuExtensionRelay(): void {
  const RELAY_TIMEOUT_MS = parseInt(process.env['ACU_EXTENSION_TIMEOUT_MS'] ?? '15000', 10);

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/extension/send') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const message = JSON.parse(body) as Record<string, unknown>;
          if (!extensionSocket || extensionSocket.destroyed) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'extension_not_connected' }));
            return;
          }

          const msgId = message['id'] as string | undefined;
          extensionSocket.write(JSON.stringify(message) + '\n');

          if (!msgId) {
            // Fire-and-forget: no id means caller doesn't expect a correlated response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          // Wait for correlated response via pendingRelayResponses
          const timer = setTimeout(() => {
            if (pendingRelayResponses.has(msgId)) {
              pendingRelayResponses.delete(msgId);
              res.writeHead(504, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: 'extension_timeout' }));
            }
          }, RELAY_TIMEOUT_MS);

          pendingRelayResponses.set(msgId, (responseData) => {
            clearTimeout(timer);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, data: responseData }));
          });
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/extension/status') {
      const connected = extensionSocket !== null && !extensionSocket.destroyed;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ connected }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(ACU_RELAY_PORT, '127.0.0.1', () => {
    log.info(`[AcuRelay] Extension relay HTTP server listening on port ${ACU_RELAY_PORT}`);
  });

  server.on('error', (err) => {
    log.warn('[AcuRelay] Failed to start extension relay server:', err.message);
  });
}

// ============================================================================
// Quick Chat Mini-Window (Cmd+Shift+A)
// ============================================================================

function createMiniWindow(): BrowserWindow {
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
    if (!win.webContents.isDevToolsFocused()) win.hide();
  });

  win.on('close', (e) => {
    e.preventDefault();
    win.hide();
  });

  return win;
}

function toggleMiniWindow(): void {
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
  } else {
    miniWindow.show();
    miniWindow.focus();
  }
}

// ============================================================================
// Tray
// ============================================================================

function createTray(): void {
  const iconPath = join(__dirname, '../../build/tray-icon.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('Allternit Desktop');
  // In menu bar mode, single-click toggles window visibility
  tray.on('click', () => {
    const prefs = persistedState.get('prefs');
    if (prefs.menuBarMode) {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    }
  });
  updateTrayMenu();
}

async function updateTrayMenu(): Promise<void> {
  if (!tray) return;

  const backend = store.get('backend');
  const status = await backendManager.getStatus();
  
  const statusIcon = status.running ? '🟢' : '🔴';
  const modeLabel = backend.mode === 'bundled' ? 'Local' : 
                    backend.mode === 'remote' ? 'VPS' : 'Dev';

  // Desktop permission status for tray indicator
  let permItem: Electron.MenuItemConstructorOptions | undefined;
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
      } else if (status.screenRecording === 'denied') {
        await presentGuide('screen-recording');
      }
    },
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Allternit Desktop', enabled: false },
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
    ...(permItem ? [permItem, { type: 'separator' } as Electron.MenuItemConstructorOptions] : []),
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'Quick Chat', accelerator: QUICK_CHAT_HOTKEY, click: () => toggleMiniWindow() },
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

function extractProtocolUrl(argv: string[]): string | null {
  return argv.find((value) => value.startsWith('allternit://')) ?? null;
}

function registerProtocolHandler(): void {
  const success = process.defaultApp
    ? app.setAsDefaultProtocolClient('allternit', process.execPath, [process.argv[1]!])
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

// URLs received before authManager.initialize() completes are buffered here.
let earlyProtocolUrl: string | null = null;
let authManagerReady = false;

async function handleProtocolCallback(url: string | null): Promise<void> {
  if (!url) return;
  log.info('[Main] handleProtocolCallback:', url);

  // Buffer if auth manager hasn't initialized yet — will be flushed after initialize()
  if (!authManagerReady) {
    log.info('[Main] Auth manager not yet initialized — buffering URL');
    earlyProtocolUrl = url;
    return;
  }

  try {
    const handled = await authManager.handleCallbackUrl(url);
    log.info('[Main] handleCallbackUrl result:', handled);
    if (handled && mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (error) {
    log.error('[Main] Failed to handle auth callback URL:', error);
    dialog.showErrorBox('Authentication Error', (error as Error).message);
  }
}

// On macOS, open-url fires during will-finish-launching (before ready).
// Registering here is the documented correct place for this event.
app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    log.info('[Main] open-url fired:', url);
    event.preventDefault();
    void handleProtocolCallback(url);
  });
});

app.on('second-instance', (_event, argv) => {
  const url = extractProtocolUrl(argv);
  log.info('[Main] second-instance fired, URL:', url);
  void handleProtocolCallback(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  console.log('[Main] App is ready...');
  console.log('[Main] Initializing auth manager...');
  await authManager.initialize();
  authManagerReady = true;
  const startupBackend = store.get('backend');
  void authManager.updateBackendProfile({
    mode: startupBackend.mode,
    remoteUrl: startupBackend.remoteUrl,
  });

  // Flush any URL that arrived before initialize() completed
  const urlToProcess = earlyProtocolUrl ?? extractProtocolUrl(process.argv);
  earlyProtocolUrl = null;
  if (urlToProcess) {
    console.log('[Main] Processing buffered/startup protocol URL...');
    void handleProtocolCallback(urlToProcess);
  }

  console.log('[Main] Initializing foundation systems...');
  // Initialize foundation systems before everything else
  featureFlagManager.initialize();
  // Push flag changes to all renderer windows
  featureFlagManager.onChange((key, value) => {
    BrowserWindow.getAllWindows().forEach(w => {
      if (!w.isDestroyed()) w.webContents.send('featureFlags:changed', { key, value });
    });
  });

  // Apply startup-on-login from persisted prefs
  const prefs = persistedState.get('prefs');
  if (isMac) {
    app.setLoginItemSettings({ openAtLogin: prefs.startupOnLogin });
    if (prefs.menuBarMode) app.dock?.hide();
  }

  // Initialize MCP host if enabled
  if (featureFlagManager.get<boolean>('mcp.enabled')) {
    mcpHostManager.initialize();
  }

  // Initialize worker bus if enabled
  if (featureFlagManager.get<boolean>('workers.enabled')) {
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
  startAcuExtensionRelay();

  // Global hotkey: Cmd+Shift+A → Quick Chat floating window
  const hotkeyRegistered = globalShortcut.register(QUICK_CHAT_HOTKEY, toggleMiniWindow);
  if (!hotkeyRegistered) {
    log.warn(`[Main] Failed to register global hotkey: ${QUICK_CHAT_HOTKEY}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initializeApp();
    } else {
      mainWindow?.show();
    }
  });

  // Refresh tray every 10s
  setInterval(updateTrayMenu, 10000);

  // ── Permission re-check on app activation ────────────────────────────────
  // macOS users can revoke permissions in System Settings at any time.
  // Silently re-check when the app becomes active and push updates to renderer.
  app.on('did-become-active', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
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
  dialog.showErrorBox('Allternit Desktop Startup Error', error instanceof Error ? error.message : 'Unknown startup failure');
  app.quit();
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
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
  notebookManager.stop();
  stopVM().catch(() => {}); // best-effort Lima VM shutdown
  // Remove dev session credentials file so stale credentials don't persist across restarts
  if (isDev) {
    const sessionFile = join(os.homedir(), '.allternit', 'gizzi-dev-session.json');
    fs.promises.unlink(sessionFile).catch(() => {});
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

// Research backend (notebook engine) — lazy start
ipcMain.handle('research:get-status', () => notebookManager.getStatus());
ipcMain.handle('research:start', async () => {
  const result = await notebookManager.start();
  serviceState.research = result
    ? { status: 'up', detail: 'Connected on http://127.0.0.1:5055' }
    : { status: 'down', detail: 'Failed to start' };
  pushServiceState();
  return result;
});
ipcMain.handle('research:stop', () => {
  notebookManager.stop();
  serviceState.research = { status: 'down', detail: 'Stopped' };
  pushServiceState();
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
ipcMain.handle('auth:forget-account', async (_event, userId: string) => {
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
ipcMain.on('mini-window:hide', () => { miniWindow?.hide(); });
ipcMain.on('mini-window:toggle', () => toggleMiniWindow());

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

ipcMain.handle('sidecar:get-persisted-config', () => persistedSidecarConfig);
ipcMain.handle('sidecar:clear-persisted-config', () => {
  persistedSidecarConfig = null;
  return true;
});

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
  const nextBackend = { ...store.get('backend'), ...config };
  store.set('backend', nextBackend);
  void authManager.updateBackendProfile({
    mode: nextBackend.mode,
    remoteUrl: nextBackend.remoteUrl,
  });
  mainWindow?.webContents.send('connection:state', config);
});

// ============================================================================
// IPC: VM Setup (onboarding) — Lima-based
// Lima manages the Ubuntu VM lifecycle via `limactl`. No custom images needed.
// Install: brew install lima
// ============================================================================

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

// "check-images-exist" now means "is Lima installed and the VM provisioned?"
ipcMain.handle('vm-setup:check-images-exist', async () => {
  const limaReady = await isLimaInstalled();
  log.info(`[VM Setup] Lima installed: ${limaReady}`);
  return limaReady;
});

// "download-images" now means "install Lima via brew if not present"
ipcMain.handle('vm-setup:download-images', async (event) => {
  const alreadyInstalled = await isLimaInstalled();
  if (alreadyInstalled) {
    event.sender.send('vm-setup:download-progress', {
      stage: 'complete',
      fileName: 'lima',
      bytesDownloaded: 1,
      totalBytes: 1,
      speed: 0,
      eta: 0,
    });
    return true;
  }

  log.info('[VM Setup] Installing Lima...');
  await installLima();
  event.sender.send('vm-setup:download-progress', {
    stage: 'complete',
    fileName: 'lima',
    bytesDownloaded: 1,
    totalBytes: 1,
    speed: 0,
    eta: 0,
  });
  return true;
});

ipcMain.handle('vm-setup:initialize-vm', async (event) => {
  const sendProgress = (stage: string, message: string, progress: number) => {
    event.sender.send('vm-setup:init-progress', { stage, message, progress });
  };

  try {
    sendProgress('verifying', 'Checking Lima installation...', 10);
    const limaReady = await isLimaInstalled();
    if (!limaReady) {
      throw new Error('Lima is not installed. Run vm-setup:download-images first.');
    }

    await startVM(sendProgress);
    log.info('[VM Setup] Lima VM started successfully');
    return true;
  } catch (error) {
    log.error('[VM Setup] Failed to start Lima VM:', error);
    throw new Error(`Failed to start VM: ${(error as Error).message}`);
  }
});

ipcMain.handle('vm-setup:get-vm-status', async (): Promise<'running' | 'stopped' | 'error'> => {
  const status = await getVMStatus();
  if (status === 'running') return 'running';
  if (status === 'error') return 'error';
  return 'stopped';
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

// ============================================================================
// IPC: Permission Guide — macOS permission detection + native overlay
// ============================================================================

ipcMain.handle('permission-guide:check', async () => checkPermissions());

ipcMain.handle('permission-guide:present', async (_event, panel: 'accessibility' | 'screen-recording') =>
  presentGuide(panel)
);

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

ipcMain.handle('featureFlags:get', (_event, key?: string) =>
  key ? featureFlagManager.get(key) : featureFlagManager.getAll()
);

ipcMain.handle('featureFlags:set', (_event, key: string, value: unknown) => {
  featureFlagManager.set(key, value as import('./feature-flags.js').FlagValue);
  return true;
});

// ============================================================================
// IPC: Persisted State
// ============================================================================

ipcMain.handle('state:get', (_event, key: string) => persistedState.get(key as never));

ipcMain.handle('state:set', (_event, key: string, value: unknown) => {
  persistedState.set(key as never, value as never);
  // Push to all renderer windows
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.webContents.send('state:changed', { key, value });
  });
  return true;
});

ipcMain.handle('state:patch', (_event, key: string, partial: unknown) => {
  persistedState.patch(key as never, partial as never);
  return true;
});

// ============================================================================
// IPC: Find in Page
// ============================================================================

ipcMain.handle('window:find-in-page', (_event, text: string, options?: Electron.FindInPageOptions) => {
  if (!mainWindow || !text) return;
  mainWindow.webContents.findInPage(text, options);
});

ipcMain.handle('window:find-stop', (_event, keepSelection?: boolean) => {
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

ipcMain.handle('locale:set', (_event, locale: string) => {
  persistedState.patch('prefs', { locale });
  BrowserWindow.getAllWindows().forEach(w => {
    if (!w.isDestroyed()) w.webContents.send('locale:changed', locale);
  });
  return true;
});

// ============================================================================
// IPC: Menu Bar Mode + Startup on Login
// ============================================================================

ipcMain.handle('menuBar:getMode', () => persistedState.get('prefs').menuBarMode);

ipcMain.handle('menuBar:setMode', (_event, enabled: boolean) => {
  persistedState.patch('prefs', { menuBarMode: enabled });
  if (isMac) {
    if (enabled) {
      app.dock?.hide();
    } else {
      app.dock?.show();
    }
  }
  mainWindow?.webContents.send('menuBar:modeChanged', enabled);
  return true;
});

ipcMain.handle('startup:getOnLogin', () => persistedState.get('prefs').startupOnLogin);

ipcMain.handle('startup:setOnLogin', (_event, enabled: boolean) => {
  persistedState.patch('prefs', { startupOnLogin: enabled });
  if (isMac) app.setLoginItemSettings({ openAtLogin: enabled });
  return true;
});

// ============================================================================
// IPC: Context Menu (native right-click for webview)
// ============================================================================

app.whenReady().then(() => {
  app.on('browser-window-created', (_e, win) => {
    win.webContents.on('context-menu', (_event, params) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = [];

      if (params.selectionText) {
        menuItems.push(
          { label: 'Copy', role: 'copy' },
          { type: 'separator' },
        );
      }
      if (params.isEditable) {
        menuItems.push(
          { label: 'Cut', role: 'cut' },
          { label: 'Copy', role: 'copy' },
          { label: 'Paste', role: 'paste' },
          { type: 'separator' },
          { label: 'Select All', role: 'selectAll' },
        );
      }
      if (!params.selectionText && !params.isEditable) {
        menuItems.push(
          { label: 'Back', enabled: win.webContents.canGoBack(), click: () => win.webContents.goBack() },
          { label: 'Forward', enabled: win.webContents.canGoForward(), click: () => win.webContents.goForward() },
          { label: 'Reload', click: () => win.webContents.reload() },
        );
      }
      if (isDev) {
        menuItems.push(
          { type: 'separator' },
          { label: 'Inspect Element', click: () => win.webContents.inspectElement(params.x, params.y) },
        );
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

ipcMain.handle('mcp:list-tools', (_event, serverId?: string) => mcpHostManager.listTools(serverId));

ipcMain.handle('mcp:call-tool', async (_event, serverId: string, toolName: string, args: unknown) => {
  try {
    const result = await mcpHostManager.callTool(serverId, toolName, args);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('mcp:add-server', async (_event, id: string, config: unknown) => {
  try {
    await mcpHostManager.addServer(id, config as import('./mcp-host-manager.js').McpServerConfig);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('mcp:remove-server', async (_event, id: string) => {
  try {
    await mcpHostManager.removeServer(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

// ============================================================================
// IPC: Worker Bus
// ============================================================================

ipcMain.handle('worker:send', async (_event, workerName: string, message: unknown) => {
  try {
    const result = await workerBus.send(workerName, message as import('./workers/worker-bus.js').WorkerMessage);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle('worker:list', () =>
  ['sqlite', 'search', 'shell-path'].filter(name => workerBus.isAlive(name))
);

// ============================================================================
// IPC: HyperFrames — render HTML artifacts as MP4/MOV/WebM video
// Requires: npx hyperframes (install via `npx skills add heygen-com/hyperframes`)
// ============================================================================

ipcMain.handle('hyperframes:check', async () => {
  return new Promise<{ available: boolean; version?: string }>((resolve) => {
    execFile('npx', ['hyperframes', '--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) resolve({ available: false });
      else resolve({ available: true, version: stdout.trim() });
    });
  });
});

ipcMain.handle('hyperframes:render', async (event, html: string, options: {
  format?: 'mp4' | 'mov' | 'webm';
  fps?: number;
  width?: number;
  height?: number;
}) => {
  const { format = 'mp4', fps = 30, width = 1920, height = 1080 } = options;
  const tmpDir = os.tmpdir();
  const stamp = Date.now();
  const srcFile = join(tmpDir, `allternit-hf-${stamp}.html`);
  const outFile = join(tmpDir, `allternit-hf-${stamp}.${format}`);

  try {
    fs.writeFileSync(srcFile, html, 'utf-8');

    const renderResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const proc = execFile(
        'npx',
        ['hyperframes', 'render', srcFile,
          '--output', outFile,
          '--fps', String(fps),
          '--width', String(width),
          '--height', String(height),
        ],
        { timeout: 180_000 },
        (err) => {
          if (err) resolve({ success: false, error: err.message });
          else resolve({ success: true });
        }
      );
      proc.stdout?.on('data', (d: Buffer) => event.sender.send('hyperframes:progress', d.toString().trim()));
      proc.stderr?.on('data', (d: Buffer) => event.sender.send('hyperframes:progress', d.toString().trim()));
    });

    try { fs.unlinkSync(srcFile); } catch { /* ignore */ }

    if (!renderResult.success) return { success: false, error: renderResult.error };
    if (!fs.existsSync(outFile)) return { success: false, error: 'Render completed but output file not found' };

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
      try { fs.unlinkSync(outFile); } catch { /* ignore */ }
      return { success: false, error: 'Cancelled' };
    }

    fs.copyFileSync(outFile, saveResult.filePath);
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }

    return { success: true, savedPath: saveResult.filePath };

  } catch (err) {
    try { fs.unlinkSync(srcFile); } catch { /* ignore */ }
    try { fs.unlinkSync(outFile); } catch { /* ignore */ }
    return { success: false, error: (err as Error).message };
  }
});
