/**
 * Gizzi Code Always-On Daemon Manager
 *
 * Detects, installs, and controls the background `gizzi-code serve` service
 * used for cloud-domain routines and loops. Because it owns the canonical
 * Gizzi port, the desktop runtime adopts this process when it is installed
 * instead of starting a competing per-session server.
 */

import { spawn, spawnSync, execFile, ChildProcess } from 'child_process';
import { app } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

export const WINDOWS_TASK_NAME = 'AllternitGizzi';

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
    const client = parsed.protocol === 'https:' ? https : http;
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
    const binaryName = process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code';
    const candidates = [
      path.join(process.resourcesPath ?? '', 'bin', binaryName),
      path.resolve('cmd/gizzi-code/dist', binaryName),
      path.resolve('cmd/gizzi-code/dist/gizzi-code-win32-x64.exe'),
      path.resolve('surfaces/allternit-desktop/resources/bin', binaryName),
      binaryName,
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
        try {
          await execFilePromise('schtasks', ['/Query', '/TN', WINDOWS_TASK_NAME]);
          return true;
        } catch {
          return false;
        }
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
   * Read the Basic-auth password persisted by the service installer without
   * logging or exposing it through renderer IPC. An empty value means the
   * loopback daemon is intentionally unsecured.
   */
  async getConnectionPassword(): Promise<string | null> {
    const platform = getPlatform();

    if (platform === 'macos') {
      const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.allternit.gizzi.plist');
      if (!fs.existsSync(plistPath)) return null;

      // Prefer the credential held by the currently loaded LaunchAgent. This
      // also covers the brief migration window where the plist was rewritten
      // but launchd is still running the previous configuration.
      try {
        const uid = typeof process.getuid === 'function' ? process.getuid() : os.userInfo().uid;
        const { stdout } = await execFilePromise('/bin/launchctl', [
          'print',
          `gui/${uid}/com.allternit.gizzi`,
        ]);
        const loaded = stdout.match(/^\s*GIZZI_SERVER_PASSWORD =>\s*(.*)$/m);
        if (loaded) return loaded[1].trim() || null;
      } catch {
        // The service may be installed but not loaded; fall back to its plist.
      }

      try {
        const { stdout } = await execFilePromise('/usr/libexec/PlistBuddy', [
          '-c',
          'Print :EnvironmentVariables:GIZZI_SERVER_PASSWORD',
          plistPath,
        ]);
        return stdout.trim() || null;
      } catch {
        return null;
      }
    }

    if (platform === 'linux') {
      try {
        const service = fs.readFileSync('/etc/systemd/system/allternit-gizzi.service', 'utf8');
        const match = service.match(/^Environment="GIZZI_SERVER_PASSWORD=(.*)"$/m);
        return match?.[1] || null;
      } catch {
        return null;
      }
    }

    if (platform === 'windows') {
      const envPath = path.join(windowsDaemonDir(), 'env.cmd');
      if (!fs.existsSync(envPath)) return null;
      const text = fs.readFileSync(envPath, 'utf8');
      const match = text.match(/^set GIZZI_SERVER_PASSWORD=(.*)$/m);
      return match?.[1]?.trim() || null;
    }

    return null;
  }

  /**
   * Install and start the daemon using the bundled wizard.
   * In unattended mode (e.g. from settings), call with explicit env.
   */
  async install(password: string | null = null, apiUrl: string = URLS.API): Promise<void> {
    const platform = getPlatform();
    if (platform === 'windows') {
      await this.installWindows(password, apiUrl);
      return;
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
        GIZZI_SERVER_PASSWORD: password ?? '',
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

  private async installWindows(password: string | null, apiUrl: string): Promise<void> {
    const binary = this.resolveBinaryPath();
    if (!binary) {
      throw new Error('gizzi-code.exe binary not found.');
    }
    const daemonDir = windowsDaemonDir();
    fs.mkdirSync(daemonDir, { recursive: true });
    const files = buildWindowsDaemonFiles({
      daemonDir,
      sourceBinary: binary,
      port: DAEMON_PORT,
      password: password ?? '',
      apiUrl,
    });
    fs.copyFileSync(binary, files.destBinary);
    fs.writeFileSync(files.runCmdPath, files.runCmd, 'utf8');
    fs.writeFileSync(files.envCmdPath, files.envCmd, 'utf8');
    const xmlPath = path.join(daemonDir, 'task.xml');
    fs.writeFileSync(xmlPath, files.taskXml, 'utf8');
    try {
      await execFilePromise('schtasks', ['/Delete', '/TN', WINDOWS_TASK_NAME, '/F']);
    } catch {
      /* task may not exist yet */
    }
    await execFilePromise('schtasks', ['/Create', '/TN', WINDOWS_TASK_NAME, '/XML', xmlPath, '/F']);
    await execFilePromise('schtasks', ['/Run', '/TN', WINDOWS_TASK_NAME]);
    log.info('[GizziDaemonManager] Windows scheduled task installed:', WINDOWS_TASK_NAME);
  }

  /** Start the installed service. */
  async start(): Promise<void> {
    const platform = getPlatform();
    if (platform === 'macos') {
      await execFilePromise('launchctl', ['start', 'com.allternit.gizzi']);
    } else if (platform === 'linux') {
      await execFilePromise('systemctl', ['start', 'allternit-gizzi']);
    } else if (platform === 'windows') {
      await execFilePromise('schtasks', ['/Run', '/TN', WINDOWS_TASK_NAME]);
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
    } else if (platform === 'windows') {
      await execFilePromise('schtasks', ['/End', '/TN', WINDOWS_TASK_NAME]);
    } else {
      throw new Error(`Stop not implemented for ${platform}`);
    }
  }

  /** Sync stop for app-quit — Electron will not wait on async before-quit. */
  stopSync(): void {
    const platform = getPlatform();
    try {
      if (platform === 'macos') {
        spawnSync('launchctl', ['stop', 'com.allternit.gizzi'], { timeout: 5000, stdio: 'ignore' });
      } else if (platform === 'linux') {
        spawnSync('systemctl', ['stop', 'allternit-gizzi'], { timeout: 5000, stdio: 'ignore' });
      } else if (platform === 'windows') {
        spawnSync('schtasks', ['/End', '/TN', WINDOWS_TASK_NAME], {
          timeout: 5000,
          stdio: 'ignore',
          windowsHide: true,
        });
      }
    } catch (err) {
      log.warn('[GizziDaemonManager] stopSync failed', err);
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
    } else if (platform === 'windows') {
      try { await execFilePromise('schtasks', ['/End', '/TN', WINDOWS_TASK_NAME]); } catch { /* ignore */ }
      try { await execFilePromise('schtasks', ['/Delete', '/TN', WINDOWS_TASK_NAME, '/F']); } catch { /* ignore */ }
      try { fs.rmSync(windowsDaemonDir(), { recursive: true, force: true }); } catch { /* ignore */ }
    } else {
      throw new Error(`Uninstall not implemented for ${platform}`);
    }
  }
}

function windowsDaemonDir(): string {
  const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  try {
    return path.join(app.getPath('userData'), 'gizzi-daemon');
  } catch {
    return path.join(roaming, 'Allternit Desktop', 'gizzi-daemon');
  }
}

export function buildWindowsDaemonFiles(opts: {
  daemonDir: string;
  sourceBinary: string;
  port: number;
  password: string;
  apiUrl: string;
}): { destBinary: string; runCmdPath: string; envCmdPath: string; runCmd: string; envCmd: string; taskXml: string } {
  const destBinary = path.join(opts.daemonDir, 'gizzi-code.exe');
  const runCmdPath = path.join(opts.daemonDir, 'run.cmd');
  const envCmdPath = path.join(opts.daemonDir, 'env.cmd');
  const envCmd = [
    `@echo off`,
    `set GIZZI_HOST=127.0.0.1`,
    `set GIZZI_PORT=${opts.port}`,
    `set GIZZI_SERVER_PASSWORD=${opts.password.replace(/%/g, '%%')}`,
    `set ALLTERNIT_API_URL=${opts.apiUrl}`,
    '',
  ].join('\r\n');
  const runCmd = [
    '@echo off',
    'setlocal',
    `cd /d "${opts.daemonDir}"`,
    'if exist env.cmd call env.cmd',
    `"${destBinary}" serve --port %GIZZI_PORT% --hostname 127.0.0.1 --print-logs`,
    '',
  ].join('\r\n');
  const taskXml = `<?xml version="1.0" encoding="UTF-8"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Allternit Gizzi always-on daemon</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure>
  </Settings>
  <Actions Context="Author"><Exec><Command>${runCmdPath}</Command></Exec></Actions>
</Task>
`;
  return { destBinary, runCmdPath, envCmdPath, runCmd, envCmd, taskXml };
}

export const gizziDaemonManager = new GizziDaemonManager();
