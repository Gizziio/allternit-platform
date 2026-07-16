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
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GIZZI_PORT = PORTS.GIZZI;
const HEALTH_TIMEOUT_MS = 30_000;

export interface GizziStartConfig {
  /** Credential persisted by the installed always-on daemon, when present. */
  existingPassword?: string | null;
}

type GizziProbeResult = 'ready' | 'unauthorized' | 'unhealthy' | 'unreachable';

export class GizziManager {
  private static instance: GizziManager;
  private proc: ChildProcess | null = null;
  private password: string | null = null;
  private lastConfig: GizziStartConfig | null = null;
  private usingExternalRuntime = false;
  private stopping = false;
  private resolvedBinaryPath: string | null | undefined;

  static getInstance(): GizziManager {
    if (!GizziManager.instance) {
      GizziManager.instance = new GizziManager();
    }
    return GizziManager.instance;
  }

  /** Start gizzi-code terminal server. Returns its base URL. */
  async start(config: GizziStartConfig = {}): Promise<string> {
    this.lastConfig = config;
    if (this.proc || this.usingExternalRuntime) {
      return this.getUrl();
    }

    const existingPassword = config.existingPassword ?? null;
    const existingRuntime = await this.probe(existingPassword);
    if (existingRuntime === 'ready') {
      this.password = existingPassword;
      this.usingExternalRuntime = true;
      log.info(`[GizziManager] Reusing existing Gizzi runtime at ${this.getUrl()}`);
      return this.getUrl();
    }
    if (existingRuntime === 'unauthorized') {
      throw new Error(
        `A password-protected Gizzi runtime is already using port ${GIZZI_PORT}, ` +
        'but its configured daemon credential did not match.'
      );
    }
    if (existingRuntime === 'unhealthy') {
      throw new Error(`Another unhealthy Gizzi runtime is already using port ${GIZZI_PORT}`);
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      throw new Error(
        'gizzi-code binary not found. Run the desktop build pipeline:\n' +
        '  scripts/build-desktop.sh'
      );
    }

    // The managed runtime is loopback-only and reachable only through the
    // signed desktop/API brokers. There is no second user-facing Gizzi login or
    // persistent Basic credential. `password` remains only for adopting a
    // legacy daemon until it is reinstalled.
    this.password = null;

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      // Gizzi terminal server config
      GIZZI_PORT: String(GIZZI_PORT),
      GIZZI_HOST: '127.0.0.1',
      // Point at allternit-api for operator-level routes (vm-session, rails, etc.)
      ALLTERNIT_API_URL: URLS.API,
      NODE_ENV: 'production',
    };

    log.info(`[GizziManager] Starting gizzi-code on port ${GIZZI_PORT} from ${binaryPath}`);

    const proc = spawn(binaryPath, ['serve', '--port', String(GIZZI_PORT), '--hostname', '127.0.0.1', '--print-logs'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc = proc;

    proc.stdout?.on('data', (d: Buffer) =>
      log.info('[Gizzi]', d.toString().trim())
    );
    proc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Gizzi]', d.toString().trim())
    );
    proc.on('exit', (code) => {
      log.warn(`[GizziManager] exited (code ${code})`);
      const intentionalStop = this.stopping;
      this.stopping = false;
      if (this.proc === proc) {
        this.proc = null;
        this.password = null;
      }

      // Auto-restart logic
      if (!intentionalStop && this.lastConfig && (app.isPackaged || process.env.NODE_ENV === 'production')) {
        log.info('[GizziManager] AI runtime crashed unexpectedly, respawning in 1s...');
        setTimeout(() => {
          if (this.lastConfig) {
            this.start(this.lastConfig).catch(e => 
              log.error('[GizziManager] Failed to auto-restart AI runtime:', e)
            );
          }
        }, 1000);
      }
    });

    await this.waitUntilReady();

    log.info(`[GizziManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  stop(): void {
    this.lastConfig = null;
    if (this.usingExternalRuntime) {
      log.info('[GizziManager] Detaching from always-on Gizzi runtime');
      this.usingExternalRuntime = false;
      this.password = null;
      return;
    }
    if (this.proc) {
      log.info('[GizziManager] Stopping…');
      this.stopping = true;
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

  /** True when a spawned or adopted Gizzi runtime is available. */
  isRunning(): boolean {
    return this.proc !== null || this.usingExternalRuntime;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `http://127.0.0.1:${GIZZI_PORT}/v1/global/health`;
    const authHeader = this.getAuthHeader();

    while (Date.now() < deadline) {
      if (!this.proc) {
        throw new Error('gizzi-code exited before becoming ready');
      }
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(2000),
          headers: authHeader ? { Authorization: authHeader } : undefined,
        });
        if (res.ok || res.status === 404) {
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

  private async probe(password: string | null): Promise<GizziProbeResult> {
    const authHeader = password
      ? `Basic ${Buffer.from(`gizzi:${password}`).toString('base64')}`
      : undefined;
    try {
      const res = await fetch(`${this.getUrl()}/v1/global/health`, {
        signal: AbortSignal.timeout(1000),
        headers: authHeader ? { Authorization: authHeader } : undefined,
      });
      if (res.ok || res.status === 404) return 'ready';
      if (res.status === 401) return 'unauthorized';
      return 'unhealthy';
    } catch {
      return 'unreachable';
    }
  }

  private resolveBinaryPath(): string | null {
    if (this.resolvedBinaryPath !== undefined) {
      return this.resolvedBinaryPath;
    }

    const binaryName = process.platform === 'win32' ? 'gizzi-code.exe' : 'gizzi-code';

    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
        ]
      : [
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
          path.join(app.getAppPath(), '..', '..', 'cmd', 'gizzi-code', 'dist', binaryName),
          path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
        ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.resolvedBinaryPath = p;
        log.info(`[GizziManager] Found binary at: ${p}`);
        return p;
      }
    }

    log.error('[GizziManager] gizzi-code binary not found. Searched:', candidates);
    this.resolvedBinaryPath = null;
    return null;
  }
}

export const gizziManager = GizziManager.getInstance();
