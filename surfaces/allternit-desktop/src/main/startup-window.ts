/**
 * Allternit Desktop — Startup Window (onboarding welcome + Clerk auth + loading)
 *
 * First launch / signed-out launches show a welcome step, then load the native
 * Clerk auth renderer for sign-in. Returning signed-in launches go straight to
 * the loading step.
 */

import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PLATFORM_MANIFEST } from './manifest.js';
import { openExternalAllowlisted } from './security.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    html, body { height: 100%; -webkit-app-region: no-drag; }
    body {
      font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 52px 48px 32px 48px;
      user-select: none;
    }
    /* Drag only a title-bar strip. Putting drag on body (a flex container)
       makes Chromium swallow clicks on child buttons even with no-drag. */
    .drag-bar {
      -webkit-app-region: drag;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      z-index: 1;
    }
    button, a, .btn {
      -webkit-app-region: no-drag;
      pointer-events: auto;
      position: relative;
      z-index: 2;
    }
    .step { display: none; flex-direction: column; align-items: center; width: 100%; -webkit-app-region: no-drag; }
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
    .folder-list { width: 380px; max-height: 180px; overflow-y: auto; margin-bottom: 10px; }
    .folder-empty { color: var(--soft); font-size: 12px; text-align: center; padding: 14px 0; border: 1px dashed var(--border, #ddd); border-radius: 8px; }
    .folder-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; margin-bottom: 6px; background: var(--panel); }
    .folder-path { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; }
    .folder-remove { border: none; background: none; color: var(--soft); cursor: pointer; font-size: 11px; }
    .folder-remove:hover { color: var(--down); }
    .btn:disabled { opacity: 0.5; cursor: default; }
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
  <div class="drag-bar"></div>
  <div class="step ${initialStep === 'welcome' ? 'active' : ''}" id="step-welcome">
    ${MATRIX_LOGO_SVG}
    <div class="brand">${BRAND_NAME}</div>
    <div class="tagline">${TAGLINE}</div>
    <button type="button" class="btn btn-primary" id="btn-get-started">Get started</button>
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
      <div class="stack-row"><div class="stack-name">Fabric Worker</div><div class="stack-value" id="svc-fabricWorker">Waiting…</div></div>
      <div class="stack-row"><div class="stack-name">Office Engine</div><div class="stack-value" id="svc-office">Waiting…</div></div>
      <div class="stack-row"><div class="stack-name">Platform</div><div class="stack-value" id="svc-platform">Waiting…</div></div>
    </div>
    <div id="loading">
      <div class="spinner"></div>
      <div class="status" id="status">Starting...</div>
      <div class="progress-container"><div class="progress-bar" id="progress-bar"></div></div>
      <div class="progress-text" id="progress-text"></div>
    </div>
  </div>

  <div class="step" id="step-folders">
    ${MATRIX_LOGO_SVG}
    <div class="brand" style="font-size: 22px; margin-top: 18px;">Grant workspace folders</div>
    <div class="tagline" style="max-width: 380px; text-align: center; margin-bottom: 14px;">
      Allternit Cowork only works in folders you grant. Pick one or more — you can change this later in Settings.
    </div>
    <div class="folder-list" id="folder-list"></div>
    <button type="button" class="btn" id="btn-add-folder">＋ Add folder</button>
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      <button type="button" class="btn" id="btn-skip-folders">Skip for now</button>
      <button type="button" class="btn btn-primary" id="btn-save-folders" disabled>Save &amp; continue</button>
    </div>
  </div>

  <div class="version">v${PLATFORM_MANIFEST.version}</div>

  <script>
    (function () {
      var api = window.startup;
      var btn = document.getElementById('btn-get-started');
      if (btn) {
        btn.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (api && typeof api.startLogin === 'function') {
            api.startLogin();
          } else {
            console.error('startup preload is missing; Get started cannot start login');
          }
        });
      }
      if (!api) {
        console.error('window.startup is undefined');
        return;
      }
      api.onServices(function (services) {
        var entries = [['api', 'svc-api'], ['gateway', 'svc-gateway'], ['gizzi', 'svc-gizzi'], ['fabricWorker', 'svc-fabricWorker'], ['office', 'svc-office'], ['platform', 'svc-platform']];
        for (var i = 0; i < entries.length; i++) {
          var key = entries[i][0];
          var nodeId = entries[i][1];
          var node = document.getElementById(nodeId);
          var state = services && services[key];
          if (!node || !state) continue;
          node.textContent = state.detail || state.status;
          node.className = 'stack-value ' + (state.status === 'up' ? 'up' : state.status === 'down' ? 'down' : '');
        }
      });
      api.onStatus(function (message) {
        var node = document.getElementById('status');
        if (node) node.textContent = message;
      });
      api.onProgress(function (percent) {
        document.getElementById('progress-bar').style.width = percent + '%';
        document.getElementById('progress-text').textContent = percent > 0 ? percent + '%' : '';
      });
      api.onComplete(function () {
        document.getElementById('loading').innerHTML =
          '<div style="font-size: 24px; margin-bottom: 8px; color: var(--accent); text-align: center;">✓</div>' +
          '<div style="color: var(--text); text-align: center;">Local backend connected</div>';
      });
      api.onError(function (message) {
        var node = document.getElementById('status');
        if (node) {
          node.textContent = 'Error: ' + message;
          node.style.color = 'var(--down)';
        }
      });

      // Folder-grant step (consumer-packaged Cowork P1).
      var grantedFolders = [];
      function renderFolders() {
        var list = document.getElementById('folder-list');
        var save = document.getElementById('btn-save-folders');
        if (!list || !save) return;
        list.innerHTML = grantedFolders.length === 0
          ? '<div class="folder-empty">No folders granted yet.</div>'
          : grantedFolders.map(function (f, i) {
              return '<div class="folder-row"><span class="folder-path" title="' + f.replace(/"/g, '&quot;') + '">' + f + '</span>' +
                '<button type="button" class="folder-remove" data-index="' + i + '">Remove</button></div>';
            }).join('');
        save.disabled = grantedFolders.length === 0;
        list.querySelectorAll('.folder-remove').forEach(function (btn) {
          btn.addEventListener('click', function () {
            grantedFolders.splice(Number(btn.getAttribute('data-index')), 1);
            renderFolders();
          });
        });
      }
      var addFolder = document.getElementById('btn-add-folder');
      if (addFolder) {
        addFolder.addEventListener('click', function () {
          if (typeof api.pickFolder !== 'function') return;
          api.pickFolder().then(function (folder) {
            if (folder && grantedFolders.indexOf(folder) === -1) {
              grantedFolders.push(folder);
              renderFolders();
            }
          });
        });
      }
      var saveFolders = document.getElementById('btn-save-folders');
      if (saveFolders) {
        saveFolders.addEventListener('click', function () {
          saveFolders.disabled = true;
          saveFolders.textContent = 'Saving…';
          api.saveFolders(grantedFolders.slice()).catch(function (err) {
            saveFolders.disabled = false;
            saveFolders.textContent = 'Save & continue';
            console.error('saveFolders failed', err);
          });
        });
      }
      var skipFolders = document.getElementById('btn-skip-folders');
      if (skipFolders) {
        skipFolders.addEventListener('click', function () {
          api.saveFolders(grantedFolders.slice());
        });
      }
      api.onFoldersShow(function () {
        document.getElementById('step-loading').classList.remove('active');
        document.getElementById('step-folders').classList.add('active');
        renderFolders();
      });
      api.onFoldersHide(function () {
        document.getElementById('step-folders').classList.remove('active');
        document.getElementById('step-loading').classList.add('active');
      });
    })();
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
      preload: join(__dirname, '../preload/startup.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.on('console-message', (event) => {
    log.info(`[Startup] ${event.message} (${event.sourceId}:${event.lineNumber})`);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalAllowlisted(url);
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

