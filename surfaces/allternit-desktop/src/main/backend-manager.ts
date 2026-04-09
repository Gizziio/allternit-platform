/**
 * Allternit API Manager
 *
 * Manages the allternit-api Rust binary — the operator backend that provides:
 *   - VM session management (Firecracker on Linux, Apple VF on macOS)
 *   - Rails system (Ledger, Gate, Leases, Work)
 *   - Sandbox execution
 *   - Interactive terminal (tmux-backed)
 *   - Event streaming (WebSocket)
 *
 * Port: 8013 (fixed — matches ALLTERNIT_API_PORT default in main.rs)
 *
 * Bundled binary location (set by electron-builder extraResources):
 *   - Packaged app: resources/bin/allternit-api[.exe]
 *   - Dev monorepo:  target/release/allternit-api
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

const API_PORT = 8013;
const HEALTH_TIMEOUT_MS = 30_000;

export interface BackendStatus {
  installed: boolean;
  running: boolean;
  url: string;
  version?: string;
}

export class BackendManager {
  private static instance: BackendManager;
  private proc: ChildProcess | null = null;
  private apiKey: string | null = null;

  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }

  /** Start allternit-api. Returns its base URL. */
  async ensureBackend(): Promise<string> {
    if (this.proc) {
      return this.getUrl();
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      throw new Error(
        'allternit-api binary not found. Run the desktop build pipeline:\n' +
        '  scripts/build-desktop.sh'
      );
    }

    // Per-session operator API key — prevents other local processes calling the API
    this.apiKey = crypto.randomBytes(32).toString('hex');

    const dataDir = path.join(app.getPath('userData'), 'allternit');
    fs.mkdirSync(dataDir, { recursive: true });

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ALLTERNIT_API_PORT: String(API_PORT),
      ALLTERNIT_API_HOST: '127.0.0.1',
      ALLTERNIT_OPERATOR_API_KEY: this.apiKey,
      ALLTERNIT_DATA_DIR: dataDir,
      RUST_LOG: 'info',
      NODE_ENV: 'production',
    };

    log.info(`[BackendManager] Starting allternit-api on port ${API_PORT} from ${binaryPath}`);

    this.proc = spawn(binaryPath, [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.proc.stdout?.on('data', (d: Buffer) =>
      log.info('[API]', d.toString().trim())
    );
    this.proc.stderr?.on('data', (d: Buffer) =>
      log.warn('[API]', d.toString().trim())
    );
    this.proc.on('exit', (code) => {
      log.warn(`[BackendManager] allternit-api exited (code ${code})`);
      this.proc = null;
      this.apiKey = null;
    });

    await this.waitUntilReady();

    log.info(`[BackendManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  async stopBackend(): Promise<void> {
    if (this.proc) {
      log.info('[BackendManager] Stopping allternit-api…');
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.apiKey = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${API_PORT}`;
  }

  /** Per-session bearer token for the platform server to use when calling the API */
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

  // ─── Private ──────────────────────────────────────────────────────────────

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `${this.getUrl()}/health`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (res.ok || res.status === 401) {
          // 401 = auth required but server is up
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`allternit-api did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveBinaryPath(): string | null {
    const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';

    const candidates = [
      // Packaged app — electron-builder extraResources copies resources/bin/ → app/resources/bin/
      path.join(process.resourcesPath ?? '', 'bin', binaryName),
      // Dev monorepo — built by cargo build --release
      path.join(app.getAppPath(), '..', '..', '..', '..', 'target', 'release', binaryName),
      // Fallback: resources/bin relative to desktop dir
      path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        log.info(`[BackendManager] Found binary at: ${p}`);
        return p;
      }
    }

    log.error('[BackendManager] allternit-api binary not found. Searched:', candidates);
    return null;
  }
}

export const backendManager = BackendManager.getInstance();
