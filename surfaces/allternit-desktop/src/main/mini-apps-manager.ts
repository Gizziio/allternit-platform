/**
 * Mini-apps lifecycle manager.
 *
 * Handles installing (npm install -g) and starting/stopping local mini-app
 * services (OpenClaw, Hermes) from the Electron main process.
 */

import { spawn, ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import log from 'electron-log';

// ─── Config ──────────────────────────────────────────────────────────────────

interface MiniAppConfig {
  packageName: string;
  /** Binary name after global install */
  binary: string;
  /** Args to pass when starting the service */
  startArgs: string[];
  port: number;
}

const MINI_APP_CONFIGS: Record<string, MiniAppConfig> = {
  openclaw: {
    packageName: 'openclaw',
    binary: 'openclaw',
    startArgs: ['--port', '18789'],
    port: 18789,
  },
  hermes: {
    packageName: '@allternit/hermes',
    binary: 'hermes',
    startArgs: ['--port', '18790'],
    port: 18790,
  },
};

// ─── State ────────────────────────────────────────────────────────────────────

interface RunningApp {
  id: string;
  process: ChildProcess;
  port: number;
}

const runningApps = new Map<string, RunningApp>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPortOpen(port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.on('connect', () => finish(true));
    sock.on('error', () => finish(false));
    sock.on('timeout', () => finish(false));
    sock.connect(port, '127.0.0.1');
  });
}

// ─── Install ──────────────────────────────────────────────────────────────────

export type InstallProgress = {
  id: string;
  line: string;
  type: 'stdout' | 'stderr' | 'info';
};

export type InstallResult = {
  success: boolean;
  error?: string;
};

/**
 * Installs a mini-app via npm install -g <package>.
 * Calls onProgress with each line of output.
 */
export async function installMiniApp(
  id: string,
  onProgress: (p: InstallProgress) => void,
): Promise<InstallResult> {
  const config = MINI_APP_CONFIGS[id];
  if (!config) {
    return { success: false, error: `Unknown mini-app: ${id}` };
  }

  onProgress({ id, line: `Installing ${config.packageName}…`, type: 'info' });

  return new Promise((resolve) => {
    const proc = spawn('npm', ['install', '-g', config.packageName], {
      env: { ...process.env },
      shell: true,
    });

    proc.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) onProgress({ id, line: line.trim(), type: 'stdout' });
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) onProgress({ id, line: line.trim(), type: 'stderr' });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        log.info(`[mini-apps] ${id} installed successfully`);
        onProgress({ id, line: `✓ ${config.packageName} installed`, type: 'info' });
        resolve({ success: true });
      } else {
        const msg = `npm exited with code ${code}`;
        log.warn(`[mini-apps] ${id} install failed: ${msg}`);
        resolve({ success: false, error: msg });
      }
    });

    proc.on('error', (err) => {
      log.error(`[mini-apps] ${id} install error:`, err);
      resolve({ success: false, error: err.message });
    });
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

export async function startMiniApp(
  id: string,
  onProgress?: (p: InstallProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  const config = MINI_APP_CONFIGS[id];
  if (!config) return { success: false, error: `Unknown mini-app: ${id}` };

  if (runningApps.has(id)) {
    const alreadyUp = await isPortOpen(config.port, 1000);
    if (alreadyUp) return { success: true };
    runningApps.delete(id);
  }

  onProgress?.({ id, line: `Starting ${config.binary}…`, type: 'info' });

  const proc = spawn(config.binary, config.startArgs, {
    env: { ...process.env },
    shell: true,
    detached: false,
  });

  proc.stdout?.on('data', (chunk: Buffer) => {
    log.info(`[mini-apps:${id}]`, chunk.toString().trim());
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    log.warn(`[mini-apps:${id}]`, chunk.toString().trim());
  });

  proc.on('close', (code) => {
    log.info(`[mini-apps] ${id} exited with code ${code}`);
    runningApps.delete(id);
  });

  proc.on('error', (err) => {
    log.error(`[mini-apps] ${id} start error:`, err);
    runningApps.delete(id);
  });

  runningApps.set(id, { id, process: proc, port: config.port });

  // Poll until port is open (max 10 seconds)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const up = await isPortOpen(config.port, 500);
    if (up) {
      onProgress?.({ id, line: `✓ ${config.binary} is running on :${config.port}`, type: 'info' });
      return { success: true };
    }
  }

  return { success: false, error: `${config.binary} did not bind to port ${config.port} within 10 s` };
}

// ─── Stop ─────────────────────────────────────────────────────────────────────

export function stopMiniApp(id: string): void {
  const app = runningApps.get(id);
  if (!app) return;
  try { app.process.kill('SIGTERM'); } catch { /* ignore */ }
  runningApps.delete(id);
  log.info(`[mini-apps] ${id} stopped`);
}

// ─── Status ──────────────────────────────────────────────────────────────────

export async function getMiniAppStatus(id: string): Promise<{
  managed: boolean;
  running: boolean;
  port: number | null;
}> {
  const config = MINI_APP_CONFIGS[id];
  if (!config) return { managed: false, running: false, port: null };

  const tracked = runningApps.has(id);
  const portOpen = await isPortOpen(config.port, 800);
  return { managed: tracked, running: portOpen, port: config.port };
}

export function listKnownIds(): string[] {
  return Object.keys(MINI_APP_CONFIGS);
}
