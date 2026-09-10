/**
 * Allternit Backend Manager
 *
 * Spawns and manages the unified Rust API backend.
 *   - Rust API on port 8013 (allternit-api binary)
 *
 * The legacy Python gateway and Memory Agent sidecars have been removed;
 * the Rust API now proxies directly to Gizzi (port 4096).
 */

import { app } from 'electron';
import { spawn, execFileSync, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';
import { PORTS, URLS, webhookReceiverUrl } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_PORT = PORTS.API;
// Debug builds of allternit-api can edge past 30s under a cold start; allow
// an env override and default to a more generous window in development.
const HEALTH_TIMEOUT_MS = process.env.ALLTERNIT_API_HEALTH_TIMEOUT_MS
  ? Number(process.env.ALLTERNIT_API_HEALTH_TIMEOUT_MS)
  : (!app.isPackaged ? 90_000 : 30_000);

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
  extraEnv?: Record<string, string>;
}

export class BackendManager {
  private static instance: BackendManager;
  private kernelProc: ChildProcess | null = null;
  private apiKey: string | null = null;
  private lastConfig: BackendLaunchConfig | null = null;
  private resolvedBinaryPath: string | null | undefined;
  /**
   * Crash-respawn state. Respawns use capped exponential backoff with jitter
   * so a binary that fails instantly on startup cannot hot-loop the machine.
   * A run that stays up longer than STABLE_RUN_MS resets the attempt count.
   */
  private static readonly BACKOFF_STEPS_MS = [1000, 2000, 5000, 10000, 30000];
  private static readonly STABLE_RUN_MS = 60_000;
  private respawnAttempts = 0;
  private spawnTimestamp = 0;
  private respawnTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while a shutdown was requested — exit events from that kill must not respawn. */
  private intentionalStop = false;

  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }

  /** Start the unified Rust API. Returns the base URL. */
  async ensureBackend(config: BackendLaunchConfig = {}): Promise<string> {
    this.lastConfig = {
      ...(this.lastConfig ?? {}),
      ...config,
      extraEnv: {
        ...(this.lastConfig?.extraEnv ?? {}),
        ...(config.extraEnv ?? {}),
      },
    };
    config = this.lastConfig;
    if (this.kernelProc) {
      return this.getUrl();
    }
    if (this.respawnTimer) {
      // A crash respawn is already scheduled; the health-check reuse path
      // below would otherwise race it with a second spawn.
      log.info('[BackendManager] Respawn already scheduled; skipping duplicate ensureBackend');
      return this.getUrl();
    }

    const existing = await this.probeExistingBackend();
    if (existing === 'usable') {
      log.info(`[BackendManager] Reusing existing allternit-api at ${this.getUrl()}`);
      return this.getUrl();
    }
    if (existing === 'misbehaving') {
      log.warn(
        '[BackendManager] Existing allternit-api is healthy but is not serving the platform UI ' +
          '(GET / is not HTML). Replacing it so the shell does not boot onto a 501 JSON stub.',
      );
      this.terminateListenerOnPort();
      await new Promise((r) => setTimeout(r, 400));
    }

    let binaryPath = this.resolveBinaryPath();
    let developmentCargoProject: string | null = null;
    if (!binaryPath) {
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
      if (isDev) {
        const candidate = path.resolve(__dirname, '../../../cmd/allternit-api');
        if (!fs.existsSync(path.join(candidate, 'Cargo.toml'))) {
          throw new Error(`allternit-api is unavailable: no binary and no development Cargo project at ${candidate}`);
        }
        developmentCargoProject = candidate;
        binaryPath = 'cargo';
        log.info(`[BackendManager] allternit-api binary not found; using cargo run from ${candidate}`);
      } else {
        throw new Error(
          'allternit-api is not bundled in this install. ' +
          'Windows and Linux binaries are produced on a native CI runner ' +
          '(cargo build --release -p allternit-api). Desktop does not download the API at runtime.'
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
      // Control plane is api.allternit.com. Device tokens from pairing are
      // introspected there; forcing self-hosted=true skipped that and left
      // the local API with no cloud gateway, so the UI never came up.
      ALLTERNIT_CLOUD_API_URL: process.env.ALLTERNIT_CLOUD_API_URL || URLS.CLOUD_API,
      ALLTERNIT_SELF_HOSTED: process.env.ALLTERNIT_SELF_HOSTED || 'false',
      ALLTERNIT_OPERATOR_API_KEY: this.apiKey,
      ALLTERNIT_DATA_DIR: dataDir,
      ALLTERNIT_VM_DIR: fs.existsSync(vmDir) ? vmDir : '',
      ALLTERNIT_PLATFORM_STATIC: platformStatic ?? '',
      ALLTERNIT_WEBHOOK_RECEIVER_PORT: process.env.ALLTERNIT_WEBHOOK_RECEIVER_PORT ?? String(PORTS.WEBHOOK_RECEIVER),
      ALLTERNIT_WEBHOOK_RECEIVER_URL: process.env.ALLTERNIT_WEBHOOK_RECEIVER_URL ?? webhookReceiverUrl(),
      TERMINAL_SERVER_URL: config.gizziUrl ?? process.env.TERMINAL_SERVER_URL ?? URLS.GIZZI,
      GIZZI_USERNAME: config.gizziUsername ?? process.env.GIZZI_USERNAME ?? 'gizzi',
      GIZZI_PASSWORD: config.gizziPassword ?? process.env.GIZZI_PASSWORD ?? '',
      RUST_LOG: 'info',
      NODE_ENV: 'production',
      ...(config.extraEnv ?? {}),
    };

    log.info(`[BackendManager] Starting allternit-api on port ${API_PORT} from ${binaryPath}`);
    const spawned = spawn(binaryPath, developmentCargoProject ? ['run', '--manifest-path', path.join(developmentCargoProject, 'Cargo.toml')] : [], {
      cwd: developmentCargoProject ?? undefined,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.kernelProc = spawned;
    this.intentionalStop = false;
    this.spawnTimestamp = Date.now();

    spawned.stdout?.on('data', (d: Buffer) =>
      log.info('[Kernel]', d.toString().trim())
    );
    spawned.stderr?.on('data', (d: Buffer) =>
      log.warn('[Kernel]', d.toString().trim())
    );
    spawned.on('exit', (code) => {
      log.warn(`[BackendManager] allternit-api exited (code ${code})`);
      // A newer spawn (e.g. a manual restart) may already own kernelProc; do
      // not clobber its state from this stale exit event.
      if (this.kernelProc !== spawned) return;
      this.kernelProc = null;
      this.apiKey = null;

      if (this.intentionalStop) return;

      if (app.isPackaged || process.env.NODE_ENV === 'production') {
        const stableRun = Date.now() - this.spawnTimestamp > BackendManager.STABLE_RUN_MS;
        if (stableRun) this.respawnAttempts = 0;
        const step = Math.min(this.respawnAttempts, BackendManager.BACKOFF_STEPS_MS.length - 1);
        const baseDelay = BackendManager.BACKOFF_STEPS_MS[step];
        // ±20% jitter avoids thundering-herd restarts when many desktops
        // restart a backend at once.
        const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
        this.respawnAttempts += 1;
        log.info(`[BackendManager] allternit-api crashed unexpectedly, respawning in ${delay}ms (attempt ${this.respawnAttempts})...`);
        this.respawnTimer = setTimeout(() => {
          this.respawnTimer = null;
          if (this.lastConfig) {
            this.ensureBackend(this.lastConfig).catch(e =>
              log.error('[BackendManager] Failed to auto-restart allternit-api:', e)
            );
          }
        }, delay);
        this.respawnTimer.unref?.();
      }
    });

    await this.waitForUrl(`${this.getUrl()}/health`, 'allternit-api');

    log.info(`[BackendManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  async stopBackend(): Promise<void> {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }
    this.intentionalStop = true;
    this.respawnAttempts = 0;
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
    const binaryPath = this.resolveBinaryPath(false);
    const installed = binaryPath !== null;
    let running = false;
    let version: string | undefined;

    try {
      const res = await fetch(`${this.getUrl()}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      const body = await res.clone().json().catch(() => null) as { version?: string; live?: boolean } | null;
      if (res.ok || body?.live === true) {
        running = true;
        version = body?.version;
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

  /** True when GET / returns the packaged platform HTML, not the 501 stub. */
  private async servesPlatformStatic(): Promise<boolean> {
    try {
      const res = await fetch(`${this.getUrl()}/`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) return true;
      const body = await res.text();
      return /<!doctype html/i.test(body) || /<html[\s>]/i.test(body);
    } catch {
      return false;
    }
  }

  /** SIGTERM whatever is listening on the operator API port. Packaged Desktop owns :8013. */
  private terminateListenerOnPort(): void {
    try {
      const out = execFileSync(
        'lsof',
        ['-nP', `-iTCP:${API_PORT}`, '-sTCP:LISTEN', '-t'],
        { encoding: 'utf8' },
      );
      for (const pidText of out.trim().split(/\s+/).filter(Boolean)) {
        const pid = Number(pidText);
        if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) continue;
        log.warn(`[BackendManager] Stopping leftover listener pid ${pid} on :${API_PORT}`);
        try {
          process.kill(pid, 'SIGTERM');
        } catch (error) {
          log.warn(`[BackendManager] Could not stop pid ${pid}:`, error);
        }
      }
    } catch {
      // lsof missing or nothing listening
    }
  }

  /**
   * Classify whatever is on the API port before we spawn a backend.
   * - 'usable': an existing allternit-api is up and serving the platform UI —
   *   reuse it.
   * - 'misbehaving': something answers /health but serves no platform UI —
   *   caller replaces it.
   * - 'none': nothing usable on the port — caller spawns normally.
   *
   * Fast path: a single probe that fails with ECONNREFUSED means nothing is
   * (or will be) listening, so we return 'none' immediately instead of
   * burning the full HEALTH_TIMEOUT_MS polling a closed port on every cold
   * boot. Other probe failures (timeouts, resets) may be a backend mid-start,
   * so those fall through to the patient probe.
   */
  async probeExistingBackend(): Promise<'usable' | 'misbehaving' | 'none'> {
    try {
      await fetch(`${this.getUrl()}/health`, { signal: AbortSignal.timeout(1_000) });
      return (await this.servesPlatformStatic()) ? 'usable' : 'misbehaving';
    } catch (probeErr) {
      if ((probeErr as { cause?: { code?: string } })?.cause?.code === 'ECONNREFUSED') {
        return 'none';
      }
    }
    try {
      await this.waitForUrl(`${this.getUrl()}/health`, 'existing allternit-api');
      return (await this.servesPlatformStatic()) ? 'usable' : 'misbehaving';
    } catch {
      return 'none';
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
        if (url.endsWith('/health')) {
          const health = await res.json().catch(() => null) as { live?: boolean } | null;
          if (health?.live === true) {
            log.warn(`[BackendManager] ${label} is live but degraded; continuing startup`);
            return;
          }
        }
      } catch {
        // Not ready yet.
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error(`${label} did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveBinaryPath(logDiscovery = true): string | null {
    if (this.resolvedBinaryPath !== undefined) {
      return this.resolvedBinaryPath;
    }

    const binaryName = process.platform === 'win32' ? 'allternit-api.exe' : 'allternit-api';

    // __dirname is dist/main; go up four levels to reach the repo root.
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
        ]
      : [
          path.join(repoRoot, 'target', 'debug', binaryName),
          path.join(repoRoot, 'target', 'release', binaryName),
          path.join(process.resourcesPath ?? '', 'bin', binaryName),
          path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.resolvedBinaryPath = candidate;
        if (logDiscovery) {
          log.info(`[BackendManager] Found binary at: ${candidate}`);
        }
        return candidate;
      }
    }

    log.error('[BackendManager] allternit-api binary not found. Searched:', candidates);
    this.resolvedBinaryPath = null;
    return null;
  }

  private resolvePlatformStaticPath(): string | null {
    // __dirname is dist/main; go up four levels to reach the repo root.
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'platform'),
        ]
      : [
          path.join(repoRoot, 'surfaces', 'ai.allternit.com', 'dist'),
          path.join(repoRoot, 'surfaces', 'ai.allternit.com', 'out'),
          path.join(repoRoot, 'surfaces', 'platform', 'dist'),
          path.join(repoRoot, 'surfaces', 'platform', 'out'),
        ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'index.html'))) {
        return candidate;
      }
    }

    return null;
  }
}

export const backendManager = BackendManager.getInstance();
