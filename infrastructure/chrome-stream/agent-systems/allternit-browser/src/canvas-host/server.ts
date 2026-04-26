/**
 * Canvas Host Server
 * Ported from OpenClaw dist/canvas-host/server.js
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import { fileURLToPath } from 'node:url';
import type { CanvasHostConfig, CanvasHostHandler } from '../types/index.js';
import {
  A2UI_PATH,
  CANVAS_HOST_PATH,
  CANVAS_WS_PATH,
  handleA2uiHttpRequest,
  injectCanvasLiveReload,
} from './a2ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function defaultIndexHTML(): string {
  return `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Allternit Canvas</title>
<style>
  html, body { height: 100%; margin: 0; background: #000; color: #fff; font: 16px/1.4 -apple-system, BlinkMacSystemFont, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
  .card { width: min(720px, 100%); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; padding: 18px 18px 14px; }
  .title { display: flex; align-items: baseline; gap: 10px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: 0.2px; }
  .sub { opacity: 0.75; font-size: 13px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  button { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.10); color: #fff; padding: 10px 12px; border-radius: 12px; font-weight: 600; cursor: pointer; }
  button:active { transform: translateY(1px); }
  .ok { color: #24e08a; }
  .bad { color: #ff5c5c; }
  .log { margin-top: 14px; opacity: 0.85; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; white-space: pre-wrap; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 10px; border-radius: 12px; }
</style>
<div class="wrap">
  <div class="card">
    <div class="title">
      <h1>Allternit Canvas</h1>
      <div class="sub">Interactive workspace (auto-reload enabled)</div>
    </div>

    <div class="row">
      <button id="btn-hello">Hello</button>
      <button id="btn-time">Time</button>
      <button id="btn-action">Send Action</button>
    </div>

    <div id="status" class="sub" style="margin-top: 10px;"></div>
    <div id="log" class="log">Ready.</div>
  </div>
</div>
<script>
(() => {
  const logEl = document.getElementById("log");
  const statusEl = document.getElementById("status");
  const log = (msg) => { logEl.textContent = String(msg); };

  const hasBridge = () => typeof window.allternitSendUserAction === "function";
  statusEl.innerHTML = "Bridge: " + (hasBridge() ? "<span class='ok'>ready</span>" : "<span class='bad'>missing</span>");

  function send(name, sourceId) {
    if (!hasBridge()) {
      log("No action bridge found.");
      return;
    }
    const ok = allternitSendUserAction({
      name,
      surfaceId: "main",
      sourceComponentId: sourceId,
      context: { t: Date.now() },
    });
    log(ok ? ("Sent: " + name) : ("Failed: " + name));
  }

  document.getElementById("btn-hello").onclick = () => send("hello", "demo.hello");
  document.getElementById("btn-time").onclick = () => send("time", "demo.time");
  document.getElementById("btn-action").onclick = () => send("action", "demo.action");
})();
</script>
`;
}

function normalizeUrlPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath || '/');
  const normalized = path.posix.normalize(decoded);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

async function resolveFilePath(rootReal: string, urlPath: string): Promise<{ handle: fsSync.promises.FileHandle; realPath: string } | null> {
  const normalized = normalizeUrlPath(urlPath);
  const rel = normalized.replace(/^\/+/, '');
  
  if (rel.split('/').some(p => p === '..')) return null;
  
  const tryOpen = async (relative: string) => {
    try {
      const fullPath = path.join(rootReal, relative);
      const handle = await fs.open(fullPath, 'r');
      return { handle, realPath: fullPath };
    } catch {
      return null;
    }
  };
  
  if (normalized.endsWith('/')) {
    return tryOpen(path.posix.join(rel, 'index.html'));
  }
  
  const candidate = path.join(rootReal, rel);
  try {
    const st = await fs.lstat(candidate);
    if (st.isSymbolicLink()) return null;
    if (st.isDirectory()) {
      return tryOpen(path.posix.join(rel, 'index.html'));
    }
  } catch {
    // Ignore
  }
  
  return tryOpen(rel);
}

function normalizeBasePath(rawPath?: string): string {
  const trimmed = (rawPath ?? CANVAS_HOST_PATH).trim();
  const normalized = normalizeUrlPath(trimmed || CANVAS_HOST_PATH);
  if (normalized === '/') return '/';
  return normalized.replace(/\/+$/, '');
}

async function prepareCanvasRoot(rootDir: string): Promise<string> {
  await fs.mkdir(rootDir, { recursive: true });
  const rootReal = await fs.realpath(rootDir);
  
  try {
    const indexPath = path.join(rootReal, 'index.html');
    await fs.stat(indexPath);
  } catch {
    try {
      await fs.writeFile(path.join(rootReal, 'index.html'), defaultIndexHTML(), 'utf8');
    } catch {
      // Ignore
    }
  }
  
  return rootReal;
}

function resolveDefaultCanvasRoot(): string {
  const candidates = [
    path.join(os.homedir(), '.allternit', 'canvas'),
    path.join(process.cwd(), 'canvas-root'),
  ];
  
  const existing = candidates.find(dir => {
    try {
      return fsSync.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
  
  return existing ?? candidates[0];
}

export async function createCanvasHostHandler(opts: {
  rootDir?: string;
  basePath?: string;
  liveReload?: boolean;
}): Promise<CanvasHostHandler> {
  const basePath = normalizeBasePath(opts.basePath);
  const rootDir = opts.rootDir ?? resolveDefaultCanvasRoot();
  const rootReal = await prepareCanvasRoot(rootDir);
  const liveReload = opts.liveReload !== false;
  
  const wss = liveReload ? new WebSocketServer({ noServer: true }) : null;
  const sockets = new Set<WebSocket>();
  
  if (wss) {
    wss.on('connection', (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
  }
  
  let debounce: NodeJS.Timeout | null = null;
  
  const broadcastReload = () => {
    if (!liveReload) return;
    for (const ws of sockets) {
      try {
        ws.send('reload');
      } catch {
        // Ignore
      }
    }
  };
  
  const scheduleReload = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      broadcastReload();
    }, 75);
  };
  
  let watcherClosed = false;
  const watcher = liveReload
    ? chokidar.watch(rootReal, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 75, pollInterval: 10 },
        ignored: [
          /(^|[\/])\../, // dotfiles
          /(^|[\/])node_modules([\/]|$)/,
        ],
      })
    : null;
  
  watcher?.on('all', () => scheduleReload());
  watcher?.on('error', (err) => {
    if (watcherClosed) return;
    watcherClosed = true;
    console.error(`Canvas host watcher error: ${String(err)}`);
    void watcher.close().catch(() => {});
  });
  
  const handleUpgrade = (req: any, socket: any, head: any): boolean => {
    if (!wss) return false;
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== CANVAS_WS_PATH) return false;
    
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
    return true;
  };
  
  const handleHttpRequest = async (req: any, res: any): Promise<boolean> => {
    const urlRaw = req.url;
    if (!urlRaw) return false;
    
    try {
      const url = new URL(urlRaw, 'http://localhost');
      
      if (url.pathname === CANVAS_WS_PATH) {
        res.statusCode = liveReload ? 426 : 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(liveReload ? 'Upgrade required' : 'Not found');
        return true;
      }
      
      // Handle A2UI requests
      if (await handleA2uiHttpRequest(req, res)) return true;
      
      let urlPath = url.pathname;
      if (basePath !== '/') {
        if (urlPath !== basePath && !urlPath.startsWith(`${basePath}/`)) return false;
        urlPath = urlPath === basePath ? '/' : urlPath.slice(basePath.length) || '/';
      }
      
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Method Not Allowed');
        return true;
      }
      
      const opened = await resolveFilePath(rootReal, urlPath);
      if (!opened) {
        if (urlPath === '/' || urlPath.endsWith('/')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(`<!doctype html><meta charset="utf-8" /><title>Allternit Canvas</title><pre>Missing file.\nCreate ${rootDir}/index.html</pre>`);
          return true;
        }
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Not found');
        return true;
      }
      
      const { handle, realPath } = opened;
      let data: Buffer;
      try {
        data = await handle.readFile();
      } finally {
        await handle.close().catch(() => {});
      }
      
      const lower = realPath.toLowerCase();
      const mime = lower.endsWith('.html') || lower.endsWith('.htm')
        ? 'text/html'
        : (await detectMime(realPath) ?? 'application/octet-stream');
      
      res.setHeader('Cache-Control', 'no-store');
      
      if (mime === 'text/html') {
        const html = data.toString('utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(liveReload ? injectCanvasLiveReload(html) : html);
        return true;
      }
      
      res.setHeader('Content-Type', mime);
      res.end(data);
      return true;
    } catch (err) {
      console.error(`Canvas host request failed: ${String(err)}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Error');
      return true;
    }
  };
  
  return {
    rootDir,
    basePath,
    handleHttpRequest,
    handleUpgrade,
    close: async () => {
      if (debounce) clearTimeout(debounce);
      watcherClosed = true;
      await watcher?.close().catch(() => {});
      if (wss) {
        await new Promise<void>((resolve) => wss.close(() => resolve()));
      }
    },
  };
}

export async function startCanvasHost(opts: {
  port?: number;
  host?: string;
  rootDir?: string;
  liveReload?: boolean;
}): Promise<{ port: number; rootDir: string; close: () => Promise<void> }> {
  const handler = await createCanvasHostHandler({
    rootDir: opts.rootDir,
    liveReload: opts.liveReload,
  });
  
  const server = http.createServer((req, res) => {
    if (String(req.headers.upgrade ?? '').toLowerCase() === 'websocket') return;
    
    void (async () => {
      if (await handler.handleHttpRequest(req, res)) return;
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not Found');
    })().catch((err) => {
      console.error(`Canvas host request failed: ${String(err)}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Error');
    });
  });
  
  server.on('upgrade', (req, socket, head) => {
    if (handler.handleUpgrade(req, socket, head)) return;
    socket.destroy();
  });
  
  const listenPort = typeof opts.port === 'number' && opts.port > 0 ? opts.port : 0;
  const listenHost = opts.host || '0.0.0.0';
  
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(listenPort, listenHost);
  });
  
  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : 0;
  
  console.log(`[Canvas] Host listening on http://${listenHost}:${boundPort} (root ${handler.rootDir})`);
  
  return {
    port: boundPort,
    rootDir: handler.rootDir,
    close: async () => {
      await handler.close();
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    },
  };
}

async function detectMime(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.pdf': 'application/pdf',
  };
  return mimeTypes[ext] || null;
}
