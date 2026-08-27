import { app, ipcMain } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HEALTH_TIMEOUT_MS = 90_000;

class VoiceManager {
  private proc: ChildProcess | null = null;
  private stopping = false;

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
   */
  isNativeDictationAvailable(): boolean {
    if (process.platform !== 'darwin') return false;
    const helper = path.join(process.resourcesPath ?? '', 'OpenMausBot Speech.app');
    return fs.existsSync(helper);
  }

  /**
   * Start native dictation. This is a placeholder for the OpenMausBot-style
   * NSSpeechRecognizer helper integration. When the helper is staged, this
   * method should spawn it and stream transcripts back to the renderer via
   * `webContents.send('voice:transcript', ...)`. Until then, it reports
   * unavailability so the renderer falls back to Web Speech.
   */
  async startNativeDictation(): Promise<{ success: boolean; error?: string }> {
    if (!this.isNativeDictationAvailable()) {
      return { success: false, error: 'native-dictation-not-available' };
    }
    log.info('[VoiceManager] Native dictation helper not yet wired; falling back to Web Speech.');
    return { success: false, error: 'native-dictation-not-wired' };
  }

  async stopNativeDictation(): Promise<void> {
    // No-op until the native helper is wired.
    log.info('[VoiceManager] stopNativeDictation: no native session active.');
  }

  registerIpcHandlers(): void {
    ipcMain.handle('voice:is-available', () => this.isNativeDictationAvailable());
    ipcMain.handle('voice:start-dictation', () => this.startNativeDictation());
    ipcMain.handle('voice:stop-dictation', () => this.stopNativeDictation());
  }
}

export const voiceManager = new VoiceManager();
