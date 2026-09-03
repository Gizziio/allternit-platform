import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEALTH_TIMEOUT_MS = 90_000;
const DICTATION_HELPER_NAME = 'DictationHelper';

class VoiceManager {
  private proc: ChildProcess | null = null;
  private stopping = false;
  private dictationProc: ChildProcess | null = null;

  async start(): Promise<string> {
    if (this.proc) return URLS.VOICE;
    if (await this.isHealthy()) return URLS.VOICE;

    const command = this.resolveCommand();
    if (!command) {
      throw new Error('Bundled voice service not found. Run scripts/build-desktop.sh to stage it.');
    }

    this.stopping = false;
    const env = {
      ...process.env,
      PORT: String(PORTS.VOICE),
      AUDIO_OUTPUT_DIR: path.join(app.getPath('userData'), 'voice-audio'),
      PRELOAD_MODEL: 'false',
      PATH: `${path.join(process.resourcesPath ?? '', 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    };
    fs.mkdirSync(env.AUDIO_OUTPUT_DIR, { recursive: true });

    log.info(`[VoiceManager] Starting voice service: ${command.file} ${command.args.join(' ')}`);
    this.proc = spawn(command.file, command.args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc.stdout?.on('data', (data: Buffer) => log.info('[Voice]', data.toString().trim()));
    this.proc.stderr?.on('data', (data: Buffer) => log.warn('[Voice]', data.toString().trim()));
    this.proc.on('exit', (code) => {
      log.warn(`[VoiceManager] exited (code ${code})`);
      this.proc = null;
      if (!this.stopping && app.isPackaged) {
        setTimeout(() => void this.start().catch((error) => log.error('[VoiceManager] restart failed:', error)), 1500);
      }
    });

    await this.waitUntilReady();
    log.info(`[VoiceManager] Ready at ${URLS.VOICE}`);
    return URLS.VOICE;
  }

  stop(): void {
    this.stopping = true;
    this.proc?.kill('SIGTERM');
    this.proc = null;
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${URLS.VOICE}/health`, { signal: AbortSignal.timeout(1500) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await this.isHealthy()) return;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    this.stop();
    throw new Error(`Voice service did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveCommand(): { file: string; args: string[] } | null {
    const binaryName = process.platform === 'win32' ? 'allternit-voice-service.exe' : 'allternit-voice-service';
    if (app.isPackaged) {
      const bundled = path.join(process.resourcesPath, 'bin', binaryName);
      return fs.existsSync(bundled) ? { file: bundled, args: [] } : null;
    }

    const launcher = path.join(app.getAppPath(), '..', '..', 'services', 'voice', 'launch.py');
    return fs.existsSync(launcher)
      ? { file: process.env.PYTHON ?? 'python3', args: [launcher, '--port', String(PORTS.VOICE)] }
      : null;
  }

  /**
   * Returns whether a native on-device dictation helper is available.
   * Currently macOS-only; non-macOS platforms return false so the renderer
   * falls back to Web Speech.
   *
   * In development the Swift source is compiled on first use and cached in the
   * app's userData directory. In packaged builds a prebuilt binary is expected
   * under `Resources/native/dictation-helper/DictationHelper`.
   */
  isNativeDictationAvailable(): boolean {
    if (process.platform !== 'darwin') return false;
    try {
      const helperPath = this.resolveDictationHelperPath();
      return helperPath !== null && fs.existsSync(helperPath);
    } catch {
      return false;
    }
  }

  /**
   * Start native dictation. Spawns the Swift helper, parses its stdout JSON,
   * and forwards finalized transcripts to the active renderer window via
   * `voice:transcript`. Falls back to Web Speech when the helper cannot be
   * staged or started.
   */
  async startNativeDictation(): Promise<{ success: boolean; error?: string }> {
    if (this.dictationProc) {
      return { success: true };
    }

    const helperPath = await this.ensureDictationHelper();
    if (!helperPath) {
      return { success: false, error: 'native-dictation-not-available' };
    }

    this.dictationProc = spawn(helperPath, [app.getLocale()], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let ready = false;
    const readyTimeout = setTimeout(() => {
      if (!ready) {
        log.warn('[VoiceManager] Dictation helper did not report ready; falling back to Web Speech.');
        this.stopNativeDictation();
      }
    }, 8_000);

    this.dictationProc.stdout?.on('data', (data: Buffer) => {
      for (const raw of data.toString().split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        try {
          const event = JSON.parse(line) as Record<string, unknown>;
          if (event.type === 'ready') {
            ready = true;
            clearTimeout(readyTimeout);
            log.info('[VoiceManager] Native dictation helper ready.');
            continue;
          }
          if (event.type === 'transcript' && typeof event.text === 'string') {
            this.sendToRenderer('voice:transcript', {
              text: event.text,
              isFinal: event.isFinal === true,
            });
            continue;
          }
          if (event.type === 'error' && typeof event.error === 'string') {
            log.error('[VoiceManager] Dictation helper error:', event.error);
            this.sendToRenderer('voice:transcript-error', event.error);
          }
        } catch {
          log.warn('[VoiceManager] Unparseable dictation output:', line);
        }
      }
    });

    this.dictationProc.stderr?.on('data', (data: Buffer) => {
      log.warn('[VoiceManager] Dictation helper stderr:', data.toString().trim());
    });

    this.dictationProc.on('exit', (code) => {
      log.info(`[VoiceManager] Dictation helper exited (code ${code}).`);
      clearTimeout(readyTimeout);
      this.dictationProc = null;
    });

    this.dictationProc.on('error', (err) => {
      log.error('[VoiceManager] Dictation helper spawn error:', err);
      clearTimeout(readyTimeout);
      this.dictationProc = null;
    });

    // Wait briefly for the helper to become ready before telling the renderer
    // to switch to native dictation.
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (ready) return { success: true };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.stopNativeDictation();
    return { success: false, error: 'native-dictation-ready-timeout' };
  }

  async stopNativeDictation(): Promise<void> {
    if (!this.dictationProc) return;

    const proc = this.dictationProc;
    this.dictationProc = null;

    // Send a newline on stdin to ask the helper to stop gracefully.
    try {
      proc.stdin?.write('\n');
      proc.stdin?.end();
    } catch {
      // Ignore if stdin is already closed.
    }

    // Force-kill if it does not exit promptly.
    const killTimer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }, 2_000);

    proc.on('exit', () => clearTimeout(killTimer));
    try {
      proc.kill('SIGTERM');
    } catch {
      // Already gone.
    }
  }

  private sendToRenderer(channel: string, ...args: unknown[]): void {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, ...args);
    }
  }

  private async ensureDictationHelper(): Promise<string | null> {
    const bundled = this.resolveDictationHelperPath();
    if (bundled && fs.existsSync(bundled)) return bundled;

    const sourcePath = this.resolveDictationHelperSourcePath();
    if (!sourcePath || !fs.existsSync(sourcePath)) return null;

    const cacheDir = path.join(app.getPath('userData'), 'dictation-helper');
    const cachedBinary = path.join(cacheDir, DICTATION_HELPER_NAME);

    // Recompile if the source is newer than the cached binary.
    const sourceStat = fs.statSync(sourcePath);
    let binaryStat: fs.Stats | undefined;
    try {
      binaryStat = fs.statSync(cachedBinary);
    } catch {
      // Binary does not exist yet.
    }

    if (binaryStat && binaryStat.mtimeMs >= sourceStat.mtimeMs) {
      return cachedBinary;
    }

    fs.mkdirSync(cacheDir, { recursive: true });
    const tempBinary = path.join(cacheDir, `${DICTATION_HELPER_NAME}.building`);

    return new Promise((resolve) => {
      log.info(`[VoiceManager] Compiling dictation helper: ${sourcePath}`);
      const compile = spawn('swiftc', [
        '-O',
        '-o', tempBinary,
        sourcePath,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      compile.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      compile.on('exit', (code) => {
        if (code !== 0) {
          log.error('[VoiceManager] Failed to compile dictation helper:', stderr);
          resolve(null);
          return;
        }
        try {
          fs.renameSync(tempBinary, cachedBinary);
          fs.chmodSync(cachedBinary, 0o755);
          resolve(cachedBinary);
        } catch (err) {
          log.error('[VoiceManager] Failed to stage compiled dictation helper:', err);
          resolve(null);
        }
      });

      compile.on('error', (err) => {
        log.error('[VoiceManager] Could not spawn swiftc:', err);
        resolve(null);
      });
    });
  }

  private resolveDictationHelperPath(): string | null {
    if (app.isPackaged && process.resourcesPath) {
      return path.join(process.resourcesPath, 'native', 'dictation-helper', DICTATION_HELPER_NAME);
    }
    return path.join(app.getPath('userData'), 'dictation-helper', DICTATION_HELPER_NAME);
  }

  private resolveDictationHelperSourcePath(): string | null {
    // In development the compiled main code lives at
    // surfaces/allternit-desktop/dist/main/voice-manager.js, so the Swift
    // source is two levels up under native/dictation-helper.
    const relativeToDist = path.join(__dirname, '..', '..', 'native', 'dictation-helper', 'DictationHelper.swift');
    if (fs.existsSync(relativeToDist)) return relativeToDist;

    // Fallback to the app path when running unpackaged via electron .
    const relativeToApp = path.join(app.getAppPath(), 'native', 'dictation-helper', 'DictationHelper.swift');
    if (fs.existsSync(relativeToApp)) return relativeToApp;

    return null;
  }

  registerIpcHandlers(): void {
    ipcMain.handle('voice:is-available', () => this.isNativeDictationAvailable());
    ipcMain.handle('voice:start-dictation', () => this.startNativeDictation());
    ipcMain.handle('voice:stop-dictation', () => this.stopNativeDictation());
  }
}

export const voiceManager = new VoiceManager();
