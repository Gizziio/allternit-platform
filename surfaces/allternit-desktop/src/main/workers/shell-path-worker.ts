/**
 * Shell Path Worker — async PATH resolution for macOS GUI apps.
 *
 * macOS GUI apps launched from Finder/Dock inherit a minimal PATH,
 * missing /opt/homebrew/bin, /usr/local/bin, etc. This worker spawns
 * a login shell to resolve the real PATH and caches it.
 */

import { workerData, parentPort } from 'node:worker_threads';
import { MessagePort } from 'node:worker_threads';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as os from 'node:os';

const execFileAsync = promisify(execFile);
const port: MessagePort = workerData.port;

let cachedPath: string | null = null;

async function resolveShellPath(): Promise<string> {
  if (cachedPath) return cachedPath;

  const shell = process.env.SHELL ?? '/bin/zsh';
  const isMac = process.platform === 'darwin';

  if (!isMac) {
    // On Linux the process PATH is already correct
    cachedPath = process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin';
    return cachedPath;
  }

  try {
    // Spawn a login shell and extract its PATH
    const { stdout } = await execFileAsync(shell, ['-l', '-c', 'echo $PATH'], {
      timeout: 5000,
      env: { HOME: os.homedir(), TERM: 'dumb' },
    });
    const resolved = stdout.trim();
    if (resolved) {
      cachedPath = resolved;
      return resolved;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: common locations
  const fallback = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/bin',
    '/sbin',
  ].join(':');
  cachedPath = fallback;
  return fallback;
}

port.on('message', async (msg: { id?: string; type: string }) => {
  const { id, type } = msg;
  try {
    let result: unknown;

    if (type === 'getPath') {
      result = await resolveShellPath();
    } else if (type === 'clearCache') {
      cachedPath = null;
      result = null;
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }

    if (id) port.postMessage({ id, payload: result });
  } catch (err) {
    if (id) port.postMessage({ id, error: (err as Error).message });
  }
});
