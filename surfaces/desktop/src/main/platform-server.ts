/**
 * Allternit Platform Server Manager
 *
 * Manages the Next.js standalone server that serves the platform UI.
 * Built with `ALLTERNIT_BUILD_MODE=desktop next build` → .next/standalone/server.js
 *
 * The standalone server is a self-contained Node.js process that includes all
 * page rendering, API routes, and static assets. It does NOT need a separate
 * node_modules — everything is bundled into .next/standalone/.
 *
 * The desktop bundles this directory under resources/platform-server/.
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as crypto from 'crypto';
import log from 'electron-log';

const PORT_MIN = 3100;
const PORT_MAX = 3200;
const HEALTH_TIMEOUT_MS = 30_000;

export interface PlatformServerConfig {
  /** URL of the Rust allternit-api backend */
  apiUrl: string;
  /** Bearer token for the Rust API */
  apiKey: string;
}

export class PlatformServerManager {
  private static instance: PlatformServerManager;
  private proc: ChildProcess | null = null;
  private port: number | null = null;

  static getInstance(): PlatformServerManager {
    if (!PlatformServerManager.instance) {
      PlatformServerManager.instance = new PlatformServerManager();
    }
    return PlatformServerManager.instance;
  }

  /** Start the Next.js standalone server. Returns its local URL. */
  async start(config: PlatformServerConfig): Promise<string> {
    if (this.proc && this.port) {
      return `http://127.0.0.1:${this.port}`;
    }

    const serverPath = this.resolveServerPath();
    if (!serverPath) {
      throw new Error(
        'Platform server not found. Run the desktop build pipeline first:\n' +
        '  scripts/build-desktop.sh'
      );
    }

    this.port = await findFreePort(PORT_MIN, PORT_MAX);
    log.info(`[PlatformServer] Starting on port ${this.port} from ${serverPath}`);

    // next.js standalone server respects PORT, HOSTNAME, and NEXTAUTH_URL
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      PORT: String(this.port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Rust API backend — Next.js API routes proxy to this
      ALLTERNIT_API_URL: config.apiUrl,
      ALLTERNIT_OPERATOR_API_KEY: config.apiKey,
      // Point Next.js public env at the local API
      NEXT_PUBLIC_API_BASE_URL: config.apiUrl,
      NEXT_PUBLIC_ALLTERNIT_BASE_URL: config.apiUrl,
    };

    this.proc = spawn(process.execPath, [serverPath], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.proc.stdout?.on('data', (d: Buffer) =>
      log.info('[Platform]', d.toString().trim())
    );
    this.proc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Platform]', d.toString().trim())
    );
    this.proc.on('exit', (code) => {
      log.info(`[PlatformServer] exited (code ${code})`);
      this.proc = null;
      this.port = null;
    });

    await this.waitUntilReady();

    const url = `http://127.0.0.1:${this.port}`;
    log.info(`[PlatformServer] Ready at ${url}`);
    return url;
  }

  stop(): void {
    if (this.proc) {
      log.info('[PlatformServer] Stopping…');
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.port = null;
    }
  }

  getUrl(): string | null {
    return this.port ? `http://127.0.0.1:${this.port}` : null;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `http://127.0.0.1:${this.port}/api/health`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (res.ok || res.status === 404) {
          // 404 on /api/health is fine — server is up, just no health route
          return;
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Platform server did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveServerPath(): string | null {
    const candidates = [
      // Packaged app — electron-builder puts resources next to binary
      path.join(process.resourcesPath, 'platform-server', 'server.js'),
      // Dev monorepo — surfaces/platform/.next/standalone/server.js
      path.join(app.getAppPath(), '..', '..', 'surfaces', 'platform', '.next', 'standalone', 'server.js'),
      // Relative fallback
      path.join(__dirname, '..', '..', 'resources', 'platform-server', 'server.js'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        log.info(`[PlatformServer] Found server at: ${p}`);
        return p;
      }
    }

    log.error('[PlatformServer] server.js not found. Searched:', candidates);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findFreePort(min: number, max: number): Promise<number> {
  for (let port = min; port <= max; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => { s.close(); resolve(true); });
      s.listen(port, '127.0.0.1');
    });
    if (free) return port;
  }
  throw new Error(`No free port in range ${min}–${max}`);
}

export const platformServerManager = PlatformServerManager.getInstance();
