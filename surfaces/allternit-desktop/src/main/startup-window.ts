/**
 * Allternit Desktop — Startup Window (onboarding welcome + Clerk auth + loading)
 *
 * First launch / signed-out launches show a welcome step, then load the native
 * Clerk auth renderer for sign-in. Returning signed-in launches go straight to
 * the loading step.
 */

import { BrowserWindow, shell } from 'electron';
import log from 'electron-log';
import { PLATFORM_MANIFEST } from './manifest.js';

export type StartupInitialStep = 'welcome' | 'loading';

export interface StartupWindowOptions {
  initialStep: StartupInitialStep;
}

const BRAND_NAME = 'Allternit';
const TAGLINE = 'Your AI platform, right on your desktop';
const TERMS_URL = 'https://allternit.com/terms';
const PRIVACY_URL = 'https://allternit.com/privacy';

const MATRIX_LOGO_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" width="88" height="88">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="100" height="100" fill="transparent"/>
  <g stroke="#B08D6E" stroke-width="0.5" opacity="0.2">
    <line x1="50" y1="50" x2="50" y2="20"/>
    <line x1="50" y1="50" x2="50" y2="80"/>
    <line x1="50" y1="50" x2="25" y2="50"/>
    <line x1="50" y1="50" x2="75" y2="50"/>
    <line x1="50" y1="50" x2="30" y2="30" opacity="0.1"/>
    <line x1="50" y1="50" x2="70" y2="30" opacity="0.1"/>
    <line x1="50" y1="50" x2="30" y2="70" opacity="0.1"/>
    <line x1="50" y1="50" x2="70" y2="70" opacity="0.1"/>
  </g>
  <g fill="#B08D6E" opacity="0.4">
    <rect x="49" y="19" width="2" height="2"/>
    <rect x="49" y="79" width="2" height="2"/>
    <rect x="24" y="49" width="2" height="2"/>
    <rect x="74" y="49" width="2" height="2"/>
  </g>
  <rect x="30" y="70" width="10" height="10" fill="#B08D6E" opacity="0.8"/>
  <rect x="30" y="58" width="10" height="10" fill="#B08D6E" opacity="0.9"/>
  <rect x="30" y="46" width="10" height="10" fill="#B08D6E"/>
  <rect x="38" y="36" width="10" height="10" fill="#B08D6E"/>
  <rect x="60" y="70" width="10" height="10" fill="#B08D6E" opacity="0.8"/>
  <rect x="60" y="58" width="10" height="10" fill="#B08D6E" opacity="0.9"/>
  <rect x="60" y="46" width="10" height="10" fill="#B08D6E"/>
  <rect x="52" y="36" width="10" height="10" fill="#B08D6E"/>
  <rect x="38" y="46" width="10" height="10" fill="#B08D6E" opacity="0.7"/>
  <rect x="52" y="46" width="10" height="10" fill="#B08D6E" opacity="0.7"/>
  <rect x="45" y="24" width="10" height="10" fill="#B08D6E"/>
  <rect x="45" y="58" width="10" height="10" fill="#9A7658" opacity="0.9"/>
  <circle cx="50" cy="50" r="3" fill="#B08D6E" filter="url(#glow)"/>
</svg>`;

function buildStartupHtml(initialStep: StartupInitialStep): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg: #faf9f7;
      --panel: #fffefc;
      --border: #e1e5eb;
      --border-strong: #c9d0da;
      --text: #1a1916;
      --text-strong: #0d0c0a;
      --muted: #74716b;
      --soft: #989590;
      --accent: #B08D6E;
      --accent-hover: #9A7658;
      --up: #1f7a3a;
      --down: #9c2a25;
      --btn-primary-bg: #1a1916;
      --btn-primary-fg: #faf9f7;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 48px 32px 48px;
      -webkit-app-region: drag;
      user-select: none;
    }
    button, a { -webkit-app-region: no-drag; }
    .step { display: none; flex-direction: column; align-items: center; width: 100%; }
    .step.active { display: flex; }
    .brand {
      font-family: 'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif;
      font-size: 34px;
      font-weight: 700;
      color: var(--text-strong);
      margin-top: 28px;
      margin-bottom: 10px;
      letter-spacing: 0.4px;
    }
    .tagline {
      font-size: 15px;
      color: var(--muted);
      margin-bottom: 56px;
      text-align: center;
    }
    .btn {
      width: 100%;
      max-width: 340px;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .btn-primary {
      background: var(--btn-primary-bg);
      color: var(--btn-primary-fg);
      border: 1px solid var(--btn-primary-bg);
    }
    .btn-primary:hover { opacity: 0.85; }
    .btn:disabled, .btn:disabled:hover { cursor: not-allowed; opacity: 0.5; }
    .footer-legal {
      position: absolute;
      bottom: 28px;
      left: 40px;
      right: 40px;
      font-size: 12px;
      color: var(--soft);
      text-align: center;
      line-height: 1.5;
    }
    .footer-legal a { color: var(--muted); text-decoration: none; }
    .footer-legal a:hover { color: var(--accent); }
    .spinner {
      width: 28px;
      height: 28px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { font-size: 14px; margin-bottom: 20px; text-align: center; min-height: 22px; color: var(--muted); }
    .progress-container {
      width: 100%;
      max-width: 340px;
      height: 3px;
      background: var(--border);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-bar {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s ease;
      width: 0%;
    }
    .progress-text { font-size: 11px; color: var(--soft); }
    .stack-status {
      width: 100%;
      max-width: 380px;
      display: grid;
      gap: 8px;
      margin-bottom: 24px;
    }
    .stack-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      font-size: 12px;
    }
    .stack-name { color: var(--text); }
    .stack-value { color: var(--soft); text-align: right; word-break: break-word; }
    .stack-value.up { color: var(--up); }
    .stack-value.down { color: var(--down); }
    .version {
      position: absolute;
      bottom: 12px;
      right: 16px;
      font-size: 11px;
      color: var(--soft);
    }
  </style>
</head>
<body>
  <div class="step ${initialStep === 'welcome' ? 'active' : ''}" id="step-welcome">
    ${MATRIX_LOGO_SVG}
    <div class="brand">${BRAND_NAME}</div>
    <div class="tagline">${TAGLINE}</div>
    <button class="btn btn-primary" id="btn-get-started">Get started</button>
    <div class="footer-legal">
      By continuing, you agree to the
      <a href="${TERMS_URL}" target="_blank" rel="noreferrer">Terms of Service</a>
      and
      <a href="${PRIVACY_URL}" target="_blank" rel="noreferrer">Privacy Policy</a>.
    </div>
  </div>

  <div class="step ${initialStep === 'loading' ? 'active' : ''}" id="step-loading">
    ${MATRIX_LOGO_SVG}
    <div class="brand" style="font-size: 24px; margin-top: 20px; margin-bottom: 24px;">${BRAND_NAME}</div>
    <div class="stack-status">
      <div class="stack-row"><div class="stack-name">Allternit API</div><div class="stack-value" id="svc-api">Starting…</div></div>
      <div class="stack-row"><div class="stack-name">Gateway</div><div class="stack-value" id="svc-gateway">Starting…</div></div>
      <div class="stack-row"><div class="stack-name">Gizzi Runtime</div><div class="stack-value" id="svc-gizzi">Starting…</div></div>
      <div class="stack-row"><div class="stack-name">Platform</div><div class="stack-value" id="svc-platform">Waiting…</div></div>
    </div>
    <div id="loading">
      <div class="spinner"></div>
      <div class="status" id="status">Starting...</div>
      <div class="progress-container"><div class="progress-bar" id="progress-bar"></div></div>
      <div class="progress-text" id="progress-text"></div>
    </div>
  </div>

  <div class="version">v${PLATFORM_MANIFEST.version}</div>

  <script>
    const { ipcRenderer } = require('electron');

    document.getElementById('btn-get-started').addEventListener('click', () => {
      ipcRenderer.send('auth:start-login');
    });

    ipcRenderer.on('auth:login-started', (_, message) => {
      // When auth starts, the main process will load the Clerk renderer.
    });

    ipcRenderer.on('services', (_, services) => {
      const entries = [['api', 'svc-api'], ['gateway', 'svc-gateway'], ['gizzi', 'svc-gizzi'], ['platform', 'svc-platform']];
      for (const [key, nodeId] of entries) {
        const node = document.getElementById(nodeId);
        const state = services && services[key];
        if (!node || !state) continue;
        node.textContent = state.detail || state.status;
        node.className = 'stack-value ' + (state.status === 'up' ? 'up' : state.status === 'down' ? 'down' : '');
      }
    });

    ipcRenderer.on('status', (_, message) => {
      const node = document.getElementById('status');
      if (node) node.textContent = message;
    });

    ipcRenderer.on('progress', (_, percent) => {
      document.getElementById('progress-bar').style.width = percent + '%';
      document.getElementById('progress-text').textContent = percent > 0 ? percent + '%' : '';
    });

    ipcRenderer.on('complete', () => {
      document.getElementById('loading').innerHTML =
        '<div style="font-size: 24px; margin-bottom: 8px; color: var(--accent); text-align: center;">✓</div>' +
        '<div style="color: var(--text); text-align: center;">Local backend connected</div>';
    });

    ipcRenderer.on('error', (_, message) => {
      const node = document.getElementById('status');
      if (node) {
        node.textContent = 'Error: ' + message;
        node.style.color = 'var(--down)';
      }
    });
  </script>
</body>
</html>`;
}

export function createStartupWindow(options: StartupWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    alwaysOnTop: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf9f7',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    log.info(`[Startup] ${message} (${sourceId}:${line})`);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildStartupHtml(options.initialStep))}`);
  return window;
}

/**
 * Loads the native Clerk auth renderer into the startup window.
 * In packaged builds this is dist/renderer/auth/index.html; in development
 * Vite serves it from src/renderer/auth/index.html.
 */

