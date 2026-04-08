/**
 * Gizzi Code Manager
 *
 * Manages the gizzi-code terminal server process — the AI runtime that powers
 * all agent sessions, conversations, tool calls, and provider routing.
 *
 * The platform surface connects to gizzi-code at TERMINAL_SERVER_URL
 * (default: http://127.0.0.1:4096). This manager owns that port.
 *
 * Bundled binary location:
 *   - Packaged app: resources/bin/gizzi-code
 *   - Dev monorepo:  cmd/gizzi-code/dist/gizzi-code
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';

const GIZZI_PORT = 4096;
const HEALTH_TIMEOUT_MS = 30_000;

export class GizziManager {
  private static instance: GizziManager;
  private proc: ChildProcess | null = null;
  private password: string | null = null;

  static getInstance(): GizziManager {
    if (!GizziManager.instance) {
      GizziManager.instance = new GizziManager();
    }
    return GizziManager.instance;
  }

  /** Start gizzi-code terminal server. Returns its base URL. */
  async start(): Promise<string> {
    if (this.proc) {
      return this.getUrl();
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      throw new Error(
        'gizzi-code binary not found. Run the desktop build pipeline:\n' +
        '  scripts/build-desktop.sh'
      );
    }

    // Per-session password — prevents other local processes hitting the runtime
    this.password = crypto.randomBytes(24).toString('hex');

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      // Gizzi terminal server config
      GIZZI_PORT: String(GIZZI_PORT),
      GIZZI_HOST: '127.0.0.1',
      GIZZI_PASSWORD: this.password,
      GIZZI_USERNAME: 'gizzi',
      // Point at allternit-api for operator-level routes (vm-session, rails, etc.)
      ALLTERNIT_API_URL: 'http://127.0.0.1:4097',
      NODE_ENV: 'production',
    };

    log.info(`[GizziManager] Starting gizzi-code on port ${GIZZI_PORT} from ${binaryPath}`);

    this.proc = spawn(binaryPath, ['serve'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.proc.stdout?.on('data', (d: Buffer) =>
      log.info('[Gizzi]', d.toString().trim())
    );
    this.proc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Gizzi]', d.toString().trim())
    );
    this.proc.on('exit', (code) => {
      log.warn(`[GizziManager] exited (code ${code})`);
      this.proc = null;
      this.password = null;
    });

    await this.waitUntilReady();

    log.info(`[GizziManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  stop(): void {
    if (this.proc) {
      log.info('[GizziManager] Stopping…');
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.password = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${GIZZI_PORT}`;
  }

  /** Basic-auth header for the platform server to pass to gizzi-code */
  getAuthHeader(): string | undefined {
    if (!this.password) return undefined;
    const token = Buffer.from(`gizzi:${this.password}`).toString('base64');
    return `Basic ${token}`;
  }

  /** Password used for GIZZI_PASSWORD env on the Next.js standalone server */
  getPassword(): string | null {
    return this.password;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `http://127.0.0.1:${GIZZI_PORT}/api/app/health`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (res.ok || res.status === 401 || res.status === 404) {
          // 401 = server up but auth required (good)
          // 404 = server up, no health route (fine)
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`gizzi-code did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveBinaryPath(): string | null {
    const binaryName = process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code';

    const candidates = [
      // Packaged app — electron-builder copies resources/bin/ → app/resources/bin/
      path.join(process.resourcesPath ?? '', 'bin', binaryName),
      // Dev monorepo — built by bun build-production.ts
      path.join(app.getAppPath(), '..', '..', '..', '..', 'cmd', 'gizzi-code', 'dist', binaryName),
      // Fallback: resources/bin relative to desktop dir
      path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        log.info(`[GizziManager] Found binary at: ${p}`);
        return p;
      }
    }

    log.error('[GizziManager] gizzi-code binary not found. Searched:', candidates);
    return null;
  }
}

export const gizziManager = GizziManager.getInstance();
