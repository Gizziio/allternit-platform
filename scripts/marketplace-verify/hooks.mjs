/**
 * Module-resolution hooks for running repo test files under plain Node:
 * - 'vitest'        -> the local shim
 * - 'electron'      -> inert stub (userData under /tmp/marketplace-verify-userdata)
 * - 'electron-log'  -> silent stub
 * - './x.js' / './x'-> existing '.ts' files (Node type-strips .ts natively)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const userData = path.join(os.tmpdir(), 'marketplace-verify-userdata');
fs.mkdirSync(userData, { recursive: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const shimUrl = pathToFileURL(path.join(here, 'vitest-shim.mjs')).href;

const electronStub = `const fn = () => {};
export const app = { getPath: () => ${JSON.stringify(userData)}, getName: () => 'marketplace-verify', getVersion: () => '0.0.0', whenReady: () => Promise.resolve(), on: fn };
export const dialog = { showMessageBox: async () => ({ response: 0 }) };
export const shell = { openExternal: async () => {}, openPath: async () => '' };
export const safeStorage = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(Buffer.from(s, 'utf8').toString('base64'), 'utf8'), decryptString: (b) => { const s = Buffer.from(b).toString('utf8'); if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('stub: damaged encrypted value'); return Buffer.from(s, 'base64').toString('utf8'); } };
export const ipcMain = { handle: fn, on: fn };
export const ipcRenderer = { invoke: async () => undefined, on: fn, once: fn, removeListener: fn, send: fn };
export class IpcRendererEvent {}
export const BrowserWindow = { getAllWindows: () => [] };
export const nativeTheme = { themeSource: 'system' };
export const Notification = class {};
export const Tray = class {};
export const Menu = { setApplicationMenu: fn };
export const nativeImage = { createFromPath: () => ({}) };
export const globalShortcut = { register: fn, unregisterAll: fn };
export const powerMonitor = { on: fn };
export const screen = { getPrimaryDisplay: () => ({ workAreaSize: { width: 1, height: 1 } }) };
export const session = { defaultSession: {} };
export const contextBridge = { exposeInMainWorld: () => {} };
export default {};`;

const logStub = 'const l = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, transports: { file: {} } }; export default l;';

export async function resolve(specifier, context, next) {
  if (specifier === 'vitest') return { url: shimUrl, shortCircuit: true };
  if (specifier === 'electron') {
    return { url: 'data:text/javascript,' + encodeURIComponent(electronStub), shortCircuit: true };
  }
  if (specifier === 'electron-log') {
    return { url: 'data:text/javascript,' + encodeURIComponent(logStub), shortCircuit: true };
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const parent = fileURLToPath(context.parentURL);
    for (const candidate of [specifier, specifier.replace(/\.js$/, '.ts'), `${specifier}.ts`]) {
      const resolved = path.resolve(path.dirname(parent), candidate);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }
  }
  return next(specifier, context);
}
