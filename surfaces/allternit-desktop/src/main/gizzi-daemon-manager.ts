/**
 * Gizzi Code Always-On Daemon Manager
 *
 * Detects, installs, and controls the background `gizzi-code serve` service
 * used for cloud-domain routines and loops. This is separate from the
 * per-session AI runtime started by GizziManager.
 */

import { spawn, execFile, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

export type DaemonPlatform = 'macos' | 'linux' | 'windows' | 'unknown';

export type DaemonStatus =
  | { installed: false; running: false }
  | { installed: true; running: false }
  | { installed: true; running: true };

const DAEMON_PORT = PORTS.GIZZI;
const HEALTH_URL = URLS.GIZZI + '/health';

function getPlatform(): DaemonPlatform {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      return 'unknown';
  }
}

function execFilePromise(file: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function isUrlReachable(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? require('node:https') : require('node:http');
    const req = client.get(url, { timeout: timeoutMs }, (res: any) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
      res.destroy();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.setTimeout(timeoutMs);
  });
}

export class GizziDaemonManager {
  private installProcess: ChildProcess | null = null;

  /** Resolve the gizzi-code binary used by the daemon. */
  resolveBinaryPath(): string | null {
    const candidates = [
      // Packaged desktop app
      path.join(process.resourcesPath, 'bin', 'gizzi-code'),
      // Dev monorepo
      path.resolve('cmd/gizzi-code/dist/gizzi-code'),
      path.resolve('surfaces/allternit-desktop/resources/bin/gizzi-code'),
      // PATH
      'gizzi-code',
    ];
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }

  /** Resolve the install script shipped with the desktop app or repo. */
  resolveInstallScript(): string | null {
    const candidates = [
      path.join(process.resourcesPath, 'scripts', 'install-daemon.sh'),
      path.resolve('cmd/gizzi-code/scripts/install-daemon.sh'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /** Check whether the always-on daemon is currently responding. */
  async isRunning(): Promise<boolean> {
    return isUrlReachable(HEALTH_URL, 2000);
  }

  /** Check whether the service file is installed for this platform. */
  async isInstalled(): Promise<boolean> {
    const platform = getPlatform();
    try {
      if (platform === 'macos') {
        const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.allternit.gizzi.plist');
        return fs.existsSync(plistPath);
      }
      if (platform === 'linux') {
        const { stdout } = await execFilePromise('systemctl', ['is-enabled', 'allternit-gizzi']);
        return stdout.trim() === 'enabled';
      }
      if (platform === 'windows') {
        // TODO: query Windows Service Manager (sc query allternit-gizzi)
        return false;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Combined status for UI consumption. */
  async getStatus(): Promise<DaemonStatus & { platform: DaemonPlatform; binary: string | null }> {
    const [installed, running, binary] = await Promise.all([
      this.isInstalled(),
      this.isRunning(),
      Promise.resolve(this.resolveBinaryPath()),
    ]);
    return {
      installed,
      running,
      platform: getPlatform(),
      binary,
    } as DaemonStatus & { platform: DaemonPlatform; binary: string | null };
  }

  /**
   * Install and start the daemon using the bundled wizard.
   * In unattended mode (e.g. from settings), call with explicit env.
   */
  async install(password: string, apiUrl: string = URLS.API): Promise<void> {
    const platform = getPlatform();
    if (platform === 'windows') {
      throw new Error('Windows daemon install is not yet implemented.');
    }
    if (platform === 'unknown') {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }

    const script = this.resolveInstallScript();
    if (!script) {
      throw new Error('Daemon install script not found.');
    }

    const binary = this.resolveBinaryPath();
    if (!binary) {
      throw new Error('gizzi-code binary not found.');
    }

    return new Promise((resolve, reject) => {
      log.info('[GizziDaemonManager] Installing daemon...');
      const env = {
        ...process.env,
        GIZZI_DAEMON_UNATTENDED: 'true',
        GIZZI_BINARY: binary,
        GIZZI_SERVER_PASSWORD: password,
        ALLTERNIT_API_URL: apiUrl,
      };

      this.installProcess = spawn('/bin/bash', [script], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      this.installProcess.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
        log.info('[GizziDaemonInstall]', d.toString().trim());
      });
      this.installProcess.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
        log.warn('[GizziDaemonInstall]', d.toString().trim());
      });

      this.installProcess.on('exit', (code) => {
        this.installProcess = null;
        if (code === 0) {
          log.info('[GizziDaemonManager] Daemon installed successfully');
          resolve();
        } else {
          reject(new Error(`Daemon install failed (code ${code}): ${stderr || stdout}`));
        }
      });

      this.installProcess.on('error', (err) => {
        this.installProcess = null;
        reject(err);
      });
    });
  }

  /** Start the installed service. */
  async start(): Promise<void> {
    const platform = getPlatform();
    if (platform === 'macos') {
      await execFilePromise('launchctl', ['start', 'com.allternit.gizzi']);
    } else if (platform === 'linux') {
      await execFilePromise('systemctl', ['start', 'allternit-gizzi']);
    } else {
      throw new Error(`Start not implemented for ${platform}`);
    }
  }

  /** Stop the installed service. */
  async stop(): Promise<void> {
    const platform = getPlatform();
    if (platform === 'macos') {
      await execFilePromise('launchctl', ['stop', 'com.allternit.gizzi']);
    } else if (platform === 'linux') {
      await execFilePromise('systemctl', ['stop', 'allternit-gizzi']);
    } else {
      throw new Error(`Stop not implemented for ${platform}`);
    }
  }

  /** Unload/disable the installed service. */
  async uninstall(): Promise<void> {
    const platform = getPlatform();
    if (platform === 'macos') {
      const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.allternit.gizzi.plist');
      try { await execFilePromise('launchctl', ['unload', plistPath]); } catch { /* ignore */ }
      try { fs.unlinkSync(plistPath); } catch { /* ignore */ }
    } else if (platform === 'linux') {
      try { await execFilePromise('systemctl', ['stop', 'allternit-gizzi']); } catch { /* ignore */ }
      try { await execFilePromise('systemctl', ['disable', 'allternit-gizzi']); } catch { /* ignore */ }
      try { fs.unlinkSync('/etc/systemd/system/allternit-gizzi.service'); } catch { /* ignore */ }
      try { await execFilePromise('systemctl', ['daemon-reload']); } catch { /* ignore */ }
    } else {
      throw new Error(`Uninstall not implemented for ${platform}`);
    }
  }
}

export const gizziDaemonManager = new GizziDaemonManager();
