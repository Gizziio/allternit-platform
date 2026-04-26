/**
 * A2UI Hosting Module
 * Ported from OpenClaw dist/canvas-host/a2ui.js
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const A2UI_PATH = '/__allternit__/a2ui';
export const CANVAS_HOST_PATH = '/__allternit__/canvas';
export const CANVAS_WS_PATH = '/__allternit__/ws';

let cachedA2uiRootReal: string | null | undefined;
let resolvingA2uiRoot: Promise<string | null> | null = null;

async function resolveA2uiRoot(): Promise<string | null> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  
  const candidates = [
    // Running from source
    path.resolve(here, 'a2ui'),
    // Running from dist without copied assets (fallback)
    path.resolve(here, '../../src/canvas-host/a2ui'),
    // Running from repo root
    path.resolve(process.cwd(), 'src/canvas-host/a2ui'),
    path.resolve(process.cwd(), 'dist/canvas-host/a2ui'),
    // From bundle directory
    path.resolve(process.cwd(), '5-ui/allternit-platform/dist-a2ui'),
  ];
  
  if (process.execPath) {
    candidates.unshift(path.resolve(path.dirname(process.execPath), 'a2ui'));
  }
  
  for (const dir of candidates) {
    try {
      const indexPath = path.join(dir, 'index.html');
      const bundlePath = path.join(dir, 'a2ui.bundle.js');
      await fs.stat(indexPath);
      await fs.stat(bundlePath);
      return dir;
    } catch {
      // Try next
    }
  }
  
  return null;
}

async function resolveA2uiRootReal(): Promise<string | null> {
  if (cachedA2uiRootReal !== undefined) return cachedA2uiRootReal;
  
  if (!resolvingA2uiRoot) {
    resolvingA2uiRoot = (async () => {
      const root = await resolveA2uiRoot();
      cachedA2uiRootReal = root ? await fs.realpath(root) : null;
      return cachedA2uiRootReal;
    })();
  }
  
  return resolvingA2uiRoot;
}

function normalizeUrlPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath || '/');
  const normalized = path.posix.normalize(decoded);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

async function resolveA2uiFilePath(rootReal: string, urlPath: string): Promise<string | null> {
  const normalized = normalizeUrlPath(urlPath);
  const rel = normalized.replace(/^\/+/, '');
  
  if (rel.split('/').some(p => p === '..')) return null;
  
  let candidate = path.join(rootReal, rel);
  
  if (normalized.endsWith('/')) {
    candidate = path.join(candidate, 'index.html');
  }
  
  try {
    const st = await fs.stat(candidate);
    if (st.isDirectory()) {
      candidate = path.join(candidate, 'index.html');
    }
  } catch {
    // Ignore
  }
  
  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  
  try {
    const lstat = await fs.lstat(candidate);
    if (lstat.isSymbolicLink()) return null;
    const real = await fs.realpath(candidate);
    if (!real.startsWith(rootPrefix)) return null;
    return real;
  } catch {
    return null;
  }
}

export function injectCanvasLiveReload(html: string): string {
  const snippet = `
<script>
(() => {
  // Cross-platform action bridge helper
  const handlerNames = ["allternitCanvasA2UIAction"];
  function postToNode(payload) {
    try {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const name of handlerNames) {
        const iosHandler = globalThis.webkit?.messageHandlers?.[name];
        if (iosHandler && typeof iosHandler.postMessage === "function") {
          iosHandler.postMessage(raw);
          return true;
        }
        const androidHandler = globalThis[name];
        if (androidHandler && typeof androidHandler.postMessage === "function") {
          androidHandler.postMessage(raw);
          return true;
        }
      }
      // Web fallback - post to parent
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'Allternit_ACTION', payload }, '*');
        return true;
      }
    } catch {}
    return false;
  }
  function sendUserAction(userAction) {
    const id = (userAction && typeof userAction.id === "string" && userAction.id.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const action = { ...userAction, id };
    return postToNode({ userAction: action });
  }
  globalThis.Allternit = globalThis.Allternit ?? {};
  globalThis.Allternit.postMessage = postToNode;
  globalThis.Allternit.sendUserAction = sendUserAction;
  globalThis.allternitPostMessage = postToNode;
  globalThis.allternitSendUserAction = sendUserAction;

  // WebSocket live reload
  try {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(proto + "://" + location.host + "${CANVAS_WS_PATH}");
    ws.onmessage = (ev) => {
      if (String(ev.data || "") === "reload") location.reload();
    };
  } catch {}
})();
</script>
`.trim();

  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx >= 0) {
    return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
  }
  return `${html}\n${snippet}\n`;
}

export async function handleA2uiHttpRequest(req: any, res: any): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) return false;
  
  const url = new URL(urlRaw, 'http://localhost');
  const basePath = url.pathname === A2UI_PATH || url.pathname.startsWith(`${A2UI_PATH}/`) 
    ? A2UI_PATH 
    : undefined;
  
  if (!basePath) return false;
  
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
    return true;
  }
  
  const a2uiRootReal = await resolveA2uiRootReal();
  if (!a2uiRootReal) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('A2UI assets not found');
    return true;
  }
  
  const rel = url.pathname.slice(basePath.length);
  const filePath = await resolveA2uiFilePath(a2uiRootReal, rel || '/');
  
  if (!filePath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return true;
  }
  
  const lower = filePath.toLowerCase();
  const mime = lower.endsWith('.html') || lower.endsWith('.htm')
    ? 'text/html'
    : (await detectMime(filePath) ?? 'application/octet-stream');
  
  res.setHeader('Cache-Control', 'no-store');
  
  if (mime === 'text/html') {
    const html = await fs.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(injectCanvasLiveReload(html));
    return true;
  }
  
  res.setHeader('Content-Type', mime);
  res.end(await fs.readFile(filePath));
  return true;
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
  };
  return mimeTypes[ext] || null;
}
