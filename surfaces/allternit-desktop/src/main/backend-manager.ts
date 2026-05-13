/**
 * Allternit Backend Manager
 *
 * Spawns and manages the unified Rust API backend.
 *   - Rust API on port 8013 (allternit-api binary)
 *
 * The legacy Python gateway and Memory Agent sidecars have been removed;
 * the Rust API now proxies directly to Gizzi (port 4096).
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess, execFile } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';
import { getBackendDownloadUrl, getBackendChecksum } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_PORT = 8013;
const HEALTH_TIMEOUT_MS = 30_000;

export interface BackendStatus {
  installed: boolean;
  running: boolean;
  url: string;
  version?: string;
}

export interface BackendLaunchConfig {
  gizziPassword?: string | null;
  gizziUsername?: string | null;
  gizziUrl?: string | null;
}

export class BackendManager {
  private static instance: BackendManager;
  private kernelProc: ChildProcess | null = null;
  private apiKey: string | null = null;
  private lastConfig: BackendLaunchConfig | null = null;

  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }

  /** Start the unified Rust API. Returns the base URL. */
  async ensureBackend(config: BackendLaunchConfig = {}): Promise<string> {
    this.lastConfig = config;
    if (this.kernelProc) {
      return this.getUrl();
    }

    let binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
      if (isDev) {
        log.warn('[BackendManager] allternit-api binary not found (dev mode)');
        return this.getUrl();
      }
      // Attempt auto-download from manifest
      try {
        binaryPath = await this.downloadBackend();
      } catch (e) {
        log.error('[BackendManager] Auto-download failed:', e);
        throw new Error(
          'allternit-api binary not found and auto-download failed. ' +
          'Please build manually: cargo build --release (in cmd/allternit-api)'
        );
      }
    }

    this.apiKey = crypto.randomBytes(32).toString('hex');

    const dataDir = path.join(app.getPath('userData'), 'allternit');
    fs.mkdirSync(dataDir, { recursive: true });

    const vmDir = path.join(process.resourcesPath ?? '', 'vm');

    // Resolve platform static files path
    const platformStatic = this.resolvePlatformStaticPath();
    if (platformStatic) {
      log.info(`[BackendManager] Platform static files: ${platformStatic}`);
    }

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ALLTERNIT_API_PORT: String(API_PORT),
      ALLTERNIT_API_HOST: '127.0.0.1',
      ALLTERNIT_OPERATOR_API_KEY: this.apiKey,
      ALLTERNIT_DATA_DIR: dataDir,
      ALLTERNIT_VM_DIR: fs.existsSync(vmDir) ? vmDir : '',
      ALLTERNIT_PLATFORM_STATIC: platformStatic ?? '',
      TERMINAL_SERVER_URL: config.gizziUrl ?? process.env.TERMINAL_SERVER_URL ?? 'http://127.0.0.1:4096',
      GIZZI_USERNAME: config.gizziUsername ?? process.env.GIZZI_USERNAME ?? 'gizzi',
      GIZZI_PASSWORD: config.gizziPassword ?? process.env.GIZZI_PASSWORD ?? '',
      RUST_LOG: 'info',
      NODE_ENV: 'production',
    };

    log.info(`[BackendManager] Starting allternit-api on port ${API_PORT} from ${binaryPath}`);
    this.kernelProc = spawn(binaryPath, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.kernelProc.stdout?.on('data', (d: Buffer) =>
      log.info('[Kernel]', d.toString().trim())
    );
    this.kernelProc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Kernel]', d.toString().trim())
    );
    this.kernelProc.on('exit', (code) => {
      log.warn(`[BackendManager] allternit-api exited (code ${code})`);
      this.kernelProc = null;
      this.apiKey = null;

      if (app.isPackaged || process.env.NODE_ENV === 'production') {
        log.info('[BackendManager] allternit-api crashed unexpectedly, respawning in 1s...');
        setTimeout(() => {
          if (this.lastConfig) {
            this.ensureBackend(this.lastConfig).catch(e =>
              log.error('[BackendManager] Failed to auto-restart allternit-api:', e)
            );
          }
        }, 1000);
      }
    });

    await this.waitForUrl(`${this.getUrl()}/health`, 'allternit-api');

    log.info(`[BackendManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  async stopBackend(): Promise<void> {
    if (this.kernelProc) {
      log.info('[BackendManager] Stopping allternit-api…');
      this.kernelProc.kill('SIGTERM');
      this.kernelProc = null;
      this.apiKey = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${API_PORT}`;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  async getStatus(): Promise<BackendStatus> {
    const binaryPath = this.resolveBinaryPath();
    const installed = binaryPath !== null;
    let running = false;
    let version: string | undefined;

    try {
      const res = await fetch(`${this.getUrl()}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        running = true;
        const data = await res.json() as { version?: string };
        version = data.version;
      }
    } catch {
      running = false;
    }

    return { installed, running, url: this.getUrl(), version };
  }

  async reset(): Promise<void> {
    log.info('[BackendManager] Performing hard reset of backend...');
    await this.stopBackend();
    if (this.lastConfig) {
      await this.ensureBackend(this.lastConfig);
    }
  }

  private async waitForUrl(url: string, label: string): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (res.ok || res.status === 401) {
          return;
        }
      } catch {
        // Not ready yet.
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error(`${label} did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  /** Download backend binary from manifest URL if missing. */
  private async downloadBackend(): Promise<string> {
    const url = getBackendDownloadUrl();
    const expectedChecksum = getBackendChecksum();
    const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';
    const binDir = path.join(app.getPath('userData'), 'bin');
    const downloadPath = path.join(binDir, `allternit-api-download-${Date.now()}`);
    const binaryPath = path.join(binDir, binaryName);

    fs.mkdirSync(binDir, { recursive: true });

    log.info(`[BackendManager] Downloading backend from ${url}...`);
    this.emitDownloadProgress({ stage: 'downloading', percent: 0 });

    await this.downloadFile(url, downloadPath, (percent) => {
      this.emitDownloadProgress({ stage: 'downloading', percent });
    });

    log.info('[BackendManager] Download complete. Verifying checksum...');
    this.emitDownloadProgress({ stage: 'verifying', percent: 100 });

    if (expectedChecksum) {
      const actualChecksum = await this.sha256File(downloadPath);
      if (actualChecksum !== expectedChecksum) {
        fs.unlinkSync(downloadPath);
        throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
      }
      log.info('[BackendManager] Checksum verified.');
    }

    // Extract archive
    log.info('[BackendManager] Extracting archive...');
    this.emitDownloadProgress({ stage: 'extracting', percent: 100 });
    await this.extractArchive(downloadPath, binDir);

    // Clean up archive
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found after extraction: ${binaryPath}`);
    }

    // Make executable on Unix
    if (process.platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }

    log.info(`[BackendManager] Backend ready at ${binaryPath}`);
    this.emitDownloadProgress({ stage: 'ready', percent: 100 });
    return binaryPath;
  }

  private emitDownloadProgress(progress: { stage: string; percent: number }): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('backend:download-progress', progress);
    }
  }

  private downloadFile(
    url: string,
    dest: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(url, { timeout: 120000 }, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              fs.unlinkSync(dest);
              this.downloadFile(redirectUrl, dest, onProgress).then(resolve).catch(reject);
              return;
            }
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          const total = parseInt(response.headers['content-length'] || '0', 10);
          let downloaded = 0;

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
            if (total > 0) {
              onProgress(Math.round((downloaded / total) * 100));
            }
          });

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlinkSync(dest);
          reject(err);
        });
    });
  }

  private sha256File(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async extractArchive(archivePath: string, destDir: string): Promise<void> {
    const ext = path.extname(archivePath);
    if (ext === '.zip') {
      // Windows: use PowerShell Expand-Archive
      await new Promise<void>((resolve, reject) => {
        execFile(
          'powershell',
          ['-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${destDir}" -Force`],
          (err) => (err ? reject(err) : resolve())
        );
      });
    } else {
      // tar.gz: use tar
      await new Promise<void>((resolve, reject) => {
        execFile('tar', ['-xzf', archivePath, '-C', destDir], (err) =>
          err ? reject(err) : resolve()
        );
      });
    }
  }

  private resolveBinaryPath(): string | null {
    const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';

    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
        ]
      : [
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
          path.join(app.getAppPath(), '..', '..', '..', 'target', 'release', binaryName),
          path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        log.info(`[BackendManager] Found binary at: ${candidate}`);
        return candidate;
      }
    }

    log.error('[BackendManager] allternit-api binary not found. Searched:', candidates);
    return null;
  }

  private resolvePlatformStaticPath(): string | null {
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'platform'),
        ]
      : [
          path.join(app.getAppPath(), '..', '..', '..', 'surfaces', 'ai.allternit.com', 'out'),
          path.join(app.getAppPath(), '..', '..', '..', 'surfaces', 'platform', 'out'),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}

export const backendManager = BackendManager.getInstance();
