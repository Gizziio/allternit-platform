/**
 * Allternit Backend Manager
 *
 * Restores the intended local topology:
 *   - Kernel/API service on port 3004
 *   - Gateway service on port 8013
 *
 * The desktop and platform should talk to the gateway URL, while the gateway
 * proxies into the local kernel.
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GATEWAY_PORT = 8013;
const KERNEL_PORT = 3004;
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
  private gatewayProc: ChildProcess | null = null;
  private memoryProc: ChildProcess | null = null;
  private apiKey: string | null = null;
  private lastConfig: BackendLaunchConfig | null = null;
  private readonly MEMORY_PORT = 3201;

  static getInstance(): BackendManager {
    if (!BackendManager.instance) {
      BackendManager.instance = new BackendManager();
    }
    return BackendManager.instance;
  }

  /** Start the local kernel and gateway. Returns the gateway base URL. */
  async ensureBackend(config: BackendLaunchConfig = {}): Promise<string> {
    this.lastConfig = config;
    if (this.kernelProc && this.gatewayProc) {
      return this.getUrl();
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
      if (isDev) {
        log.warn('[BackendManager] allternit-api binary not found, using legacy gateway URL (dev mode)');
        return this.getUrl();
      }
      throw new Error(
        'allternit-api binary not found. The backend must be built and bundled. ' +
        'Run: cargo build --release (in the allternit-api directory) and ensure ' +
        'the binary is copied to resources/bin/ before packaging.'
      );
    }

    this.apiKey = crypto.randomBytes(32).toString('hex');

    const dataDir = path.join(app.getPath('userData'), 'allternit');
    fs.mkdirSync(dataDir, { recursive: true });

    const vmDir = path.join(process.resourcesPath ?? '', 'vm');
    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ALLTERNIT_API_PORT: String(KERNEL_PORT),
      ALLTERNIT_API_HOST: '127.0.0.1',
      ALLTERNIT_OPERATOR_API_KEY: this.apiKey,
      ALLTERNIT_DATA_DIR: dataDir,
      ALLTERNIT_VM_DIR: fs.existsSync(vmDir) ? vmDir : '',
      RUST_LOG: 'info',
      NODE_ENV: 'production',
    };

    log.info(`[BackendManager] Starting allternit-api on port ${KERNEL_PORT} from ${binaryPath}`);
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

      // Auto-restart logic
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

    await this.waitForUrl(`http://127.0.0.1:${KERNEL_PORT}/health`, 'allternit-api');
    await this.ensureMemoryAgent();
    await this.ensureGateway(config);

    log.info(`[BackendManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  async stopBackend(): Promise<void> {
    if (this.gatewayProc) {
      log.info('[BackendManager] Stopping gateway…');
      this.gatewayProc.kill('SIGTERM');
      this.gatewayProc = null;
    }
    if (this.memoryProc) {
      log.info('[BackendManager] Stopping Memory Agent…');
      this.memoryProc.kill('SIGTERM');
      this.memoryProc = null;
    }
    if (this.kernelProc) {
      log.info('[BackendManager] Stopping allternit-api…');
      this.kernelProc.kill('SIGTERM');
      this.kernelProc = null;
      this.apiKey = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${GATEWAY_PORT}`;
  }

  /** Per-session bearer token kept for compatibility with existing platform wiring. */
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

  private async ensureGateway(config: BackendLaunchConfig = {}): Promise<void> {
    if (this.gatewayProc) {
      return;
    }

    const gatewayRoot = this.resolveGatewayRoot();
    const gatewayEntry = gatewayRoot
      ? path.join(gatewayRoot, 'services', 'gateway', 'service', 'src', 'main.py')
      : null;
    const pythonPath = gatewayRoot ? this.resolvePythonPath(gatewayRoot) : null;

    if (!gatewayRoot || !gatewayEntry || !fs.existsSync(gatewayEntry) || !pythonPath) {
      throw new Error('Gateway sources or Python runtime not found');
    }

    log.info(`[BackendManager] Starting gateway on port ${GATEWAY_PORT} from ${gatewayEntry}`);
    this.gatewayProc = spawn(pythonPath, [gatewayEntry, 'serve'], {
      cwd: gatewayRoot,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
        ),
        PYTHONPATH: app.isPackaged ? path.join(gatewayRoot, 'lib') : (process.env.PYTHONPATH ?? ''),
        HOST: '127.0.0.1',
        PORT: String(GATEWAY_PORT),
        TERMINAL_SERVER_URL: config.gizziUrl ?? process.env.TERMINAL_SERVER_URL ?? 'http://127.0.0.1:4096',
        GIZZI_USERNAME: config.gizziUsername ?? process.env.GIZZI_USERNAME ?? 'gizzi',
        GIZZI_PASSWORD: config.gizziPassword ?? process.env.GIZZI_PASSWORD ?? '',
        ALLOW_LOCAL_DEV_BYPASS: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.gatewayProc.stdout?.on('data', (d: Buffer) =>
      log.info('[Gateway]', d.toString().trim())
    );
    this.gatewayProc.stderr?.on('data', (d: Buffer) =>
      log.warn('[Gateway]', d.toString().trim())
    );
    this.gatewayProc.on('exit', (code) => {
      log.warn(`[BackendManager] gateway exited (code ${code})`);
      this.gatewayProc = null;
      
      // Auto-restart logic
      if (app.isPackaged || process.env.NODE_ENV === 'production') {
        log.info('[BackendManager] gateway crashed unexpectedly, respawning in 1s...');
        setTimeout(() => {
          if (this.lastConfig) {
            this.ensureGateway(this.lastConfig).catch(e => 
              log.error('[BackendManager] Failed to auto-restart gateway:', e)
            );
          }
        }, 1000);
      }
    });

    await this.waitForUrl(`${this.getUrl()}/health`, 'gateway');
  }

  private async ensureMemoryAgent(): Promise<void> {
    if (this.memoryProc) return;

    const memoryRoot = this.resolveMemoryAgentRoot();
    if (!memoryRoot || !fs.existsSync(memoryRoot)) {
      log.warn('[BackendManager] Memory Agent root not found, skipping…');
      return;
    }

    log.info(`[BackendManager] Starting Memory Agent on port ${this.MEMORY_PORT} from ${memoryRoot}`);
    
    // In dev use tsx, in packaged we use the pre-built dist
    const entryPoint = app.isPackaged 
      ? path.join(memoryRoot, 'dist', 'http-server.js')
      : path.join(memoryRoot, 'src', 'http-server.ts');
    
    const cmd = app.isPackaged ? 'node' : 'npx';
    const args = app.isPackaged ? [entryPoint] : ['tsx', entryPoint];

    this.memoryProc = spawn(cmd, args, {
      cwd: memoryRoot,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
        ),
        MEMORY_HTTP_PORT: String(this.MEMORY_PORT),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.memoryProc.stdout?.on('data', (d: Buffer) =>
      log.info('[MemoryAgent]', d.toString().trim())
    );
    this.memoryProc.stderr?.on('data', (d: Buffer) =>
      log.warn('[MemoryAgent]', d.toString().trim())
    );

    this.memoryProc.on('exit', (code) => {
      log.warn(`[BackendManager] Memory Agent exited (code ${code})`);
      this.memoryProc = null;
      
      if (app.isPackaged || process.env.NODE_ENV === 'production') {
        log.info('[BackendManager] Memory Agent crashed unexpectedly, respawning in 1s...');
        setTimeout(() => {
          this.ensureMemoryAgent().catch(e => 
            log.error('[BackendManager] Failed to auto-restart Memory Agent:', e)
          );
        }, 1000);
      }
    });

    await this.waitForUrl(`http://127.0.0.1:${this.MEMORY_PORT}/health`, 'memory-agent');
  }

  private resolveMemoryAgentRoot(): string | null {
    const root = this.resolveGatewayRoot();
    if (!root) return null;
    
    // In production, memory agent might be in resources/memory-agent
    if (app.isPackaged) {
      return path.join(process.resourcesPath ?? '', 'memory-agent');
    }
    
    return path.join(root, 'api', 'services', 'memory', 'agent');
  }

  /**
   * Hard reset all backend services
   */
  async reset(): Promise<void> {
    log.info('[BackendManager] Performing hard reset of backend services...');
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

  private resolveGatewayRoot(): string | null {
    const candidates = app.isPackaged
      ? [
          path.join(process.resourcesPath ?? '', 'gateway-runtime'),
        ]
      : [
          path.join(app.getAppPath(), '..', '..', '..'),
          path.join(app.getAppPath(), '..', '..'),
        ];

    for (const candidate of candidates) {
      const gatewayEntry = path.join(candidate, 'services', 'gateway', 'service', 'src', 'main.py');
      if (fs.existsSync(gatewayEntry)) {
        return candidate;
      }
    }

    log.error('[BackendManager] gateway repo root not found. Searched:', candidates);
    return null;
  }

  private resolvePythonPath(projectRoot: string): string | null {
    const candidates = app.isPackaged
      ? ['python3', 'python']
      : [
          path.join(projectRoot, 'services', 'gateway', 'service', '.venv', 'bin', 'python'),
          path.join(projectRoot, 'services', 'gateway', 'service', '.venv', 'bin', 'python3'),
          'python3',
          'python',
        ];

    for (const candidate of candidates) {
      if (candidate === 'python3' || candidate === 'python') {
        return candidate;
      }
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}

export const backendManager = BackendManager.getInstance();
