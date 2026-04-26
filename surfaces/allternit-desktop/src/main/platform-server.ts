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
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLATFORM_PORT = 3100;
const HEALTH_TIMEOUT_MS = 30_000;
const LOCALHOST_CLERK_PUBLISHABLE_KEY = 'pk_test_ZWFzeS1oYXdrLTUzLmNsZXJrLmFjY291bnRzLmRldiQ';
const LOCALHOST_CLERK_SECRET_KEY = 'sk_test_37qh7k8rZwwWu3QKPi2doqk10SabkYgIMCXEqkcQzi';

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
}

export interface PlatformServerConfig {
  /** URL of the Rust allternit-api backend (port 8013) */
  apiUrl: string;
  /** Bearer token for the Rust API */
  apiKey: string;
  /** URL of the gizzi-code terminal server (port 4096) */
  gizziUrl?: string;
  /** Basic-auth password for gizzi-code (username: gizzi) */
  gizziPassword?: string;
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

    if (await isPlatformHealthy(PLATFORM_PORT)) {
      this.port = PLATFORM_PORT;
      log.info(`[PlatformServer] Reusing existing healthy platform server on port ${PLATFORM_PORT}`);
      return `http://127.0.0.1:${PLATFORM_PORT}`;
    }

    const serverPath = this.resolveServerPath();
    if (!serverPath) {
      throw new Error(
        'Platform server not found. Run the desktop build pipeline first:\n' +
        '  scripts/build-desktop.sh'
      );
    }

    this.ensureDesktopDatabase();

    const bundledPlatformDir = this.resolveBundledPlatformDir();
    const repoPlatformDir = app.isPackaged
      ? null
      : path.join(app.getAppPath(), '..', '..', 'surfaces', 'allternit-platform');
    const envSourceDir = bundledPlatformDir ?? repoPlatformDir;
    const productionEnv = envSourceDir ? loadEnvFile(path.join(envSourceDir, '.env.production')) : {};
    const localEnv = envSourceDir ? loadEnvFile(path.join(envSourceDir, '.env.local')) : {};

    this.port = PLATFORM_PORT;
    log.info(`[PlatformServer] Starting on port ${this.port} from ${serverPath}`);

    // next.js standalone server respects PORT, HOSTNAME, and NEXTAUTH_URL
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(this.port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // allternit-api gateway (tools, providers, permissions, questions — port 8013)
      ALLTERNIT_API_URL: config.apiUrl,
      ALLTERNIT_OPERATOR_API_KEY: config.apiKey,
      NEXT_PUBLIC_API_BASE_URL: config.apiUrl,
      NEXT_PUBLIC_ALLTERNIT_BASE_URL: config.apiUrl,
      // runtime-gateway-proxy.ts reads this to know where to forward gateway calls
      NEXT_PUBLIC_ALLTERNIT_GATEWAY_URL: config.apiUrl,
      VITE_ALLTERNIT_GATEWAY_URL: config.apiUrl,
      // gizzi-code terminal server (agent sessions, conversations, streaming — port 4096)
      TERMINAL_SERVER_URL: config.gizziUrl ?? 'http://127.0.0.1:4096',
      GIZZI_USERNAME: 'gizzi',
      GIZZI_PASSWORD: config.gizziPassword ?? '',
      // Required for Next.js production build
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'allternit-desktop-local-development-key-32chars',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'allternit-desktop-nextauth-secret-for-local-dev',
      NEXTAUTH_URL: `http://127.0.0.1:${this.port}`,
      // Database for Prisma (using SQLite for desktop app)
      DATABASE_URL: process.env.DATABASE_URL || `file:${path.join(app.getPath('userData'), 'allternit.db')}`,
      ALLTERNIT_DESKTOP_AUTH_ENABLED: '1',
      NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH: '1',
      ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
      NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK: '0',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        LOCALHOST_CLERK_PUBLISHABLE_KEY,
      NEXT_PUBLIC_CLERK_SIGN_IN_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ||
        productionEnv.NEXT_PUBLIC_CLERK_SIGN_IN_URL ||
        '/sign-in',
      NEXT_PUBLIC_CLERK_SIGN_UP_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ||
        productionEnv.NEXT_PUBLIC_CLERK_SIGN_UP_URL ||
        '/sign-up',
    };

    const explicitPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const explicitSecretKey = process.env.CLERK_SECRET_KEY;
    const useExplicitClerkKeys = Boolean(explicitPublishableKey && explicitSecretKey);

    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = useExplicitClerkKeys
      ? explicitPublishableKey!
      : LOCALHOST_CLERK_PUBLISHABLE_KEY;
    env.CLERK_SECRET_KEY = useExplicitClerkKeys
      ? explicitSecretKey!
      : LOCALHOST_CLERK_SECRET_KEY;

    // Use Electron's own node runtime when packaged, otherwise system node
    const nodePath = app.isPackaged ? process.execPath : (process.env.NODE_EXECUTABLE_PATH || 'node');
    log.info(`[PlatformServer] Using node: ${nodePath}${app.isPackaged ? ' (Electron)' : ''}`);
    
    this.proc = spawn(nodePath, [serverPath], {
      env,
      cwd: path.dirname(serverPath),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false,
    });

    this.proc.stdout?.on('data', (d: Buffer) =>
      log.info('[Platform]', d.toString().trim())
    );
    this.proc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Platform]', d.toString().trim())
    );
    this.proc.on('exit', (code, signal) => {
      log.error(`[PlatformServer] exited (code ${code}, signal ${signal})`);
      this.proc = null;
      this.port = null;
    });
    this.proc.on('error', (err) => {
      log.error(`[PlatformServer] process error:`, err);
    });
    
    // Log the PID so we can check if it's running
    log.info(`[PlatformServer] Spawned PID: ${this.proc.pid}`);

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
    const url = `http://127.0.0.1:${this.port}/api/status`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(500) });
        if (res.ok) {
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
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath, 'platform-server', 'server.js'),
          path.join(process.resourcesPath, 'platform-server', 'surfaces', 'allternit-platform', 'server.js'),
          path.join(process.resourcesPath, 'platform-server', 'standalone', 'surfaces', 'allternit-platform', 'server.js'),
        ]
      : [
          path.join(process.resourcesPath, 'platform-server', 'server.js'),
          path.join(process.resourcesPath, 'platform-server', 'surfaces', 'allternit-platform', 'server.js'),
          path.join(process.resourcesPath, 'platform-server', 'standalone', 'surfaces', 'allternit-platform', 'server.js'),
          path.join(app.getAppPath(), '..', '..', 'surfaces', 'allternit-platform', '.next', 'standalone', 'server.js'),
          path.join(app.getAppPath(), '..', '..', 'surfaces', 'allternit-platform', '.next', 'standalone', 'surfaces', 'allternit-platform', 'server.js'),
          path.join(__dirname, '..', '..', 'resources', 'platform-server', 'server.js'),
          path.join(__dirname, '..', '..', 'resources', 'platform-server', 'surfaces', 'allternit-platform', 'server.js'),
          path.join(__dirname, '..', '..', 'resources', 'platform-server', 'standalone', 'surfaces', 'allternit-platform', 'server.js'),
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

  private ensureDesktopDatabase(): void {
    const targetPath = path.join(app.getPath('userData'), 'allternit.db');

    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    } catch (error) {
      log.warn('[PlatformServer] Failed to create desktop database directory:', error);
    }

    const currentSize = fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
    if (currentSize > 0) {
      return;
    }

    const seedPath = this.resolveSeedDatabasePath();
    if (!seedPath) {
      log.warn('[PlatformServer] No seed database found for desktop bootstrap');
      return;
    }

    fs.copyFileSync(seedPath, targetPath);
    log.info(`[PlatformServer] Seeded desktop database from ${seedPath}`);
  }

  private resolveSeedDatabasePath(): string | null {
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath, 'platform-server', 'prisma', 'data', 'allternit.db'),
          path.join(
            process.resourcesPath,
            'platform-server',
            'standalone',
            'surfaces',
            'allternit-platform',
            'prisma',
            'data',
            'allternit.db',
          ),
        ]
      : [
          path.join(process.resourcesPath, 'platform-server', 'prisma', 'data', 'allternit.db'),
          path.join(
            process.resourcesPath,
            'platform-server',
            'standalone',
            'surfaces',
            'allternit-platform',
            'prisma',
            'data',
            'allternit.db',
          ),
          path.join(app.getAppPath(), '..', '..', 'surfaces', 'allternit-platform', 'prisma', 'data', 'allternit.db'),
          path.join(__dirname, '..', '..', 'resources', 'platform-server', 'prisma', 'data', 'allternit.db'),
          path.join(
            __dirname,
            '..',
            '..',
            'resources',
            'platform-server',
            'standalone',
            'surfaces',
            'allternit-platform',
            'prisma',
            'data',
            'allternit.db',
          ),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).size > 0) {
        return candidate;
      }
    }

    return null;
  }

  private resolveBundledPlatformDir(): string | null {
    const candidates = [
      path.join(process.resourcesPath, 'platform-server', 'surfaces', 'allternit-platform'),
      path.join(process.resourcesPath, 'platform-server'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findFreePort(min: number, max: number): Promise<number> {
  throw new Error(`Unexpected dynamic port request for platform server: ${min}–${max}`);
}

async function isPlatformHealthy(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/status`, {
      signal: AbortSignal.timeout(750),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const platformServerManager = PlatformServerManager.getInstance();
