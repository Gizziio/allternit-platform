import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import log from 'electron-log';

export interface ComputerUseDriverStatus {
  available: boolean;
  running: boolean;
  embedded: boolean;
  executable?: string;
  socket?: string;
  error?: string;
}

const INSTALLED_CUA_DRIVER = '/Applications/CuaDriver.app/Contents/MacOS/cua-driver';
const INSTALLED_CUA_SOCKET = path.join(os.homedir(), 'Library/Caches/cua-driver/cua-driver.sock');

function isInstalledCuaDriver(executable: string): boolean {
  return path.resolve(executable) === path.resolve(INSTALLED_CUA_DRIVER);
}

/**
 * Owns Allternit's Cua Driver backend on macOS.
 *
 * On macOS, Computer History admission requires the exact executable inside the
 * verified, installed `/Applications/CuaDriver.app` bundle. A standalone
 * embedded binary cannot satisfy that check. Therefore this manager prefers the
 * installed app when present and connects to its daemon socket. If the app is
 * not installed, it falls back to spawning the embedded binary directly so that
 * regular computer-use actions still work (Accessibility/Screen Recording are
 * then attributed to Allternit Desktop when it is signed).
 */
class ComputerUseDriverManager {
  private child: ChildProcess | null = null;
  private socketPath: string | null = null;
  private lastError: string | undefined;

  resolveExecutable(): string | null {
    const candidates = [
      process.env.ALLTERNIT_CUA_DRIVER_PATH,
      // Prefer the installed app bundle; it is the only configuration that
      // supports Computer History on macOS.
      INSTALLED_CUA_DRIVER,
      path.join(process.resourcesPath ?? '', 'computer-use', 'cua-driver'),
      !app.isPackaged ? path.join(os.homedir(), '.local', 'bin', 'cua-driver') : undefined,
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return path.resolve(candidate);
    }
    return null;
  }

  private async waitForSocket(deadlineMs: number, label: string): Promise<boolean> {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      if (this.child && this.child.exitCode !== null) break;
      if (this.socketPath && fs.existsSync(this.socketPath)) {
        this.lastError = undefined;
        log.info(`[ComputerUseDriver] ${label} ready; socket=${this.socketPath}`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  async start(): Promise<ComputerUseDriverStatus> {
    if (process.platform !== 'darwin') {
      return { available: false, running: false, embedded: false, error: 'Embedded Cua Driver is currently packaged for macOS only.' };
    }

    const executable = this.resolveExecutable();
    if (!executable) {
      this.lastError = 'Bundled computer-use driver is missing.';
      return this.getStatus();
    }

    // If the installed CuaDriver.app is present, use its daemon. History and
    // all TCC attribution stay with the verified Cua Driver app bundle.
    if (isInstalledCuaDriver(executable)) {
      if (fs.existsSync(INSTALLED_CUA_SOCKET)) {
        this.socketPath = INSTALLED_CUA_SOCKET;
        this.lastError = undefined;
        log.info('[ComputerUseDriver] using installed CuaDriver.app daemon');
        return this.getStatus();
      }

      // No daemon is running. Try to launch it through LaunchServices so it
      // receives the correct bundle identity and keychain entitlements.
      log.info('[ComputerUseDriver] launching installed CuaDriver.app daemon');
      const open = spawn('open', ['-n', '-g', '-a', 'CuaDriver', '--args', 'serve'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      await new Promise<void>((resolve) => open.on('exit', () => resolve()));

      this.socketPath = INSTALLED_CUA_SOCKET;
      const ready = await this.waitForSocket(10_000, 'installed CuaDriver.app daemon');
      if (!ready) {
        this.lastError ??= 'Installed CuaDriver.app daemon did not become ready within 10 seconds.';
      }
      return this.getStatus();
    }

    // Fall back to the embedded binary. Computer History will not be available
    // because the standalone executable fails the installed-app admission check.
    const runtimeDir = path.join(app.getPath('userData'), 'computer-use');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    this.socketPath = path.join(runtimeDir, 'cua-driver.sock');
    fs.rmSync(this.socketPath, { force: true });

    const env = {
      ...process.env,
      CUA_DRIVER_EMBEDDED: '1',
      CUA_DRIVER_HOST_BUNDLE_ID: 'com.allternit.desktop',
      CUA_DRIVER_RS_TELEMETRY_ENABLED: 'false',
      CUA_TELEMETRY_ENABLED: 'false',
      NO_COLOR: '1',
    };
    const child = spawn(executable, [
      'serve',
      '--embedded',
      '--host-bundle-id', 'com.allternit.desktop',
      '--socket', this.socketPath,
    ], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    this.child = child;

    child.stdout?.on('data', (data: Buffer) => log.info('[ComputerUseDriver]', data.toString().trim()));
    child.stderr?.on('data', (data: Buffer) => log.warn('[ComputerUseDriver]', data.toString().trim()));
    child.on('error', (error) => {
      this.lastError = error.message;
      log.error('[ComputerUseDriver] failed:', error);
    });
    child.on('exit', (code) => {
      if (code && code !== 0) this.lastError = `Embedded driver exited with code ${code}.`;
      this.child = null;
      log.info(`[ComputerUseDriver] stopped (code ${code ?? 'unknown'})`);
    });

    const ready = await this.waitForSocket(10_000, 'embedded driver');
    if (!ready) {
      this.lastError ??= 'Embedded driver did not become ready within 10 seconds.';
    }
    return this.getStatus();
  }

  stop(): void {
    this.child?.kill('SIGTERM');
    this.child = null;
    // Only remove sockets we created ourselves; never delete the installed app's socket.
    if (this.socketPath && !this.socketPath.startsWith(INSTALLED_CUA_SOCKET)) {
      fs.rmSync(this.socketPath, { force: true });
    }
    this.socketPath = null;
  }

  getLaunchEnvironment(): Record<string, string> {
    const executable = this.resolveExecutable();
    if (!executable || !this.socketPath) return {};
    const env: Record<string, string> = {
      ALLTERNIT_CUA_DRIVER_PATH: executable,
      ALLTERNIT_CUA_DRIVER_SOCKET: this.socketPath,
      CUA_DRIVER_RS_TELEMETRY_ENABLED: 'false',
      CUA_TELEMETRY_ENABLED: 'false',
    };
    if (!isInstalledCuaDriver(executable)) {
      env.ALLTERNIT_CUA_DRIVER_EMBEDDED = 'true';
    }
    return env;
  }

  getStatus(): ComputerUseDriverStatus {
    const executable = this.resolveExecutable();
    const socketAlive = Boolean(this.socketPath && fs.existsSync(this.socketPath));
    const childAlive = Boolean(this.child && this.child.exitCode === null);
    return {
      available: executable !== null,
      running: socketAlive && (childAlive || isInstalledCuaDriver(executable ?? '')),
      embedded: Boolean(this.child),
      executable: executable ?? undefined,
      socket: this.socketPath ?? undefined,
      error: this.lastError,
    };
  }
}

export const computerUseDriverManager = new ComputerUseDriverManager();
