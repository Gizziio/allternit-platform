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

export interface MiniAppConfig {
  packageName: string;
  installCommand: string;
  installArgs: string[];
  /** Binary name after global install */
  binary: string;
  /** Args to pass when starting the service */
  startArgs: string[];
  port: number;
  statusArgs?: string[];
  harnessManaged?: boolean;
}

export const MINI_APP_CONFIGS: Record<string, MiniAppConfig> = {
  openclaw: {
    packageName: 'openclaw@latest',
    installCommand: 'npm',
    installArgs: ['install', '-g', 'openclaw@latest'],
    binary: 'openclaw',
    startArgs: ['gateway', '--port', '18789'],
    port: 18789,
  },
  hermes: {
    packageName: 'NousResearch/hermes-agent',
    installCommand: '/bin/bash',
    installArgs: ['-lc', 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash'],
    binary: 'hermes',
    startArgs: ['dashboard', '--no-open', '--port', '9119'],
    port: 9119,
  },
  'oh-my-pi': {
    packageName: 'can1357/oh-my-pi',
    installCommand: '/bin/bash',
    installArgs: ['-lc', 'curl -fsSL https://omp.sh/install | sh'],
    binary: 'omp',
    startArgs: ['acp'],
    port: 0,
    harnessManaged: true,
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

function commandSucceeds(binary: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(binary, args, { env: { ...process.env }, shell: true, stdio: 'ignore' });
    proc.once('error', () => resolve(false));
    proc.once('close', (code) => resolve(code === 0));
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
    const proc = spawn(config.installCommand, config.installArgs, {
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
  if (config.harnessManaged) {
    return { success: false, error: `${config.binary} is started by the Allternit/Gizzi harness when a session begins` };
  }

  if (runningApps.has(id)) {
    const alreadyUp = config.port === 0 || await isPortOpen(config.port, 1000);
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

  if (config.port === 0) {
    // Hermes starts a managed gateway daemon and exits; OMP remains attached as
    // an RPC child. Both are verified through their upstream lifecycle shape.
    if (config.statusArgs) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const up = await commandSucceeds(config.binary, config.statusArgs);
      if (!up) return { success: false, error: `${config.binary} gateway did not report a running status` };
    }
    onProgress?.({ id, line: `✓ ${config.binary} runtime started`, type: 'info' });
    return { success: true };
  }

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

export function launchMiniAppDesktop(id: string): { success: boolean; error?: string } {
  if (id !== 'hermes') return { success: false, error: `No desktop launcher for mini-app: ${id}` };
  try {
    const proc = spawn('hermes', ['desktop'], { env: { ...process.env }, shell: true, detached: true, stdio: 'ignore' });
    proc.unref();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
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
  const portOpen = config.statusArgs
    ? await commandSucceeds(config.binary, config.statusArgs)
    : config.port === 0 ? tracked : await isPortOpen(config.port, 800);
  return { managed: tracked, running: portOpen, port: config.port || null };
}

export function listKnownIds(): string[] {
  return Object.keys(MINI_APP_CONFIGS);
}
