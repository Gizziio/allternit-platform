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

/**
 * Owns Allternit's embedded Cua Driver child process.
 *
 * This process must be spawned directly by the signed Electron app. Moving the
 * spawn into allternit-api or a gateway breaks macOS's TCC responsibility chain
 * and produces a second privacy entry. Embedded mode prevents Cua Driver from
 * relaunching itself through LaunchServices, so Accessibility and Screen
 * Recording remain attributed to com.allternit.desktop.
 */
class ComputerUseDriverManager {
  private child: ChildProcess | null = null;
  private socketPath: string | null = null;
  private lastError: string | undefined;

  resolveExecutable(): string | null {
    const candidates = [
      process.env.ALLTERNIT_CUA_DRIVER_PATH,
      path.join(process.resourcesPath ?? '', 'computer-use', 'cua-driver'),
      // Development-only convenience; packaged builds always use the bundled copy.
      !app.isPackaged ? '/Applications/CuaDriver.app/Contents/MacOS/cua-driver' : undefined,
      !app.isPackaged ? path.join(os.homedir(), '.local', 'bin', 'cua-driver') : undefined,
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) return path.resolve(candidate);
    }
    return null;
  }

  async start(): Promise<ComputerUseDriverStatus> {
    if (this.child && this.socketPath) return this.getStatus();
    if (process.platform !== 'darwin') {
      return { available: false, running: false, embedded: false, error: 'Embedded Cua Driver is currently packaged for macOS only.' };
    }

    const executable = this.resolveExecutable();
    if (!executable) {
      this.lastError = 'Bundled computer-use driver is missing.';
      return this.getStatus();
    }

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

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      if (fs.existsSync(this.socketPath)) {
        this.lastError = undefined;
        log.info('[ComputerUseDriver] embedded driver ready; TCC owner=com.allternit.desktop');
        return this.getStatus();
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.lastError ??= 'Embedded driver did not become ready within 10 seconds.';
    return this.getStatus();
  }

  stop(): void {
    this.child?.kill('SIGTERM');
    this.child = null;
    if (this.socketPath) fs.rmSync(this.socketPath, { force: true });
  }

  getLaunchEnvironment(): Record<string, string> {
    const executable = this.resolveExecutable();
    if (!executable || !this.socketPath) return {};
    return {
      ALLTERNIT_CUA_DRIVER_PATH: executable,
      ALLTERNIT_CUA_DRIVER_SOCKET: this.socketPath,
      ALLTERNIT_CUA_DRIVER_EMBEDDED: 'true',
      CUA_DRIVER_RS_TELEMETRY_ENABLED: 'false',
      CUA_TELEMETRY_ENABLED: 'false',
    };
  }

  getStatus(): ComputerUseDriverStatus {
    const executable = this.resolveExecutable();
    return {
      available: executable !== null,
      running: Boolean(this.child && this.child.exitCode === null && this.socketPath && fs.existsSync(this.socketPath)),
      embedded: Boolean(this.child),
      executable: executable ?? undefined,
      socket: this.socketPath ?? undefined,
      error: this.lastError,
    };
  }
}

export const computerUseDriverManager = new ComputerUseDriverManager();
