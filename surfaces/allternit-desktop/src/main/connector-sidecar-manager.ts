/**
 * Connector Sidecar Manager
 *
 * Manages the open-connector process — the self-hosted OAuth/API-key
 * connector gateway (see services/open-connector/PROVENANCE.md) that
 * allternit-api's connector routes proxy to
 * (cmd/allternit-api/src/open_connector_proxy.rs) and that gizzi-code's
 * Lens vault connectors call directly for providers the curated Rust path
 * can't serve correctly yet (see cmd/gizzi-code/src/vault/connectors/sidecar.ts).
 *
 * Unlike allternit-api/gizzi-code, this isn't a compiled standalone binary:
 * `bun build --compile` fails at runtime (open-connector uses Node's
 * built-in `node:sqlite`, which Bun's compile target doesn't implement —
 * verified 2026-08-04). Instead this runs the TypeScript source directly
 * through Electron's own bundled Node runtime (`ELECTRON_RUN_AS_NODE=1`),
 * which does support `node:sqlite` — also verified working end-to-end
 * against a real health check before this was written.
 *
 * Bundled source location:
 *   - Packaged app: resources/connector-sidecar/ (source + node_modules,
 *     see extraResources in package.json)
 *   - Dev monorepo:  services/open-connector/
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import log from 'electron-log';
import { PORTS, URLS } from './config.js';

const SIDECAR_PORT = PORTS.CONNECTOR_SIDECAR;
const HEALTH_TIMEOUT_MS = 30_000;

export interface ConnectorSidecarStartConfig {
  /** ALLTERNIT_ENCRYPTION_KEY-style shared secret — reused here so the
   * sidecar's own credential store (services/open-connector's
   * OOMOL_CONNECT_ENCRYPTION_KEY) is encrypted with the same
   * authManager-persisted key as everything else, not a second one. */
  encryptionKey: string;
  adminToken: string;
  runtimeToken: string;
}

export class ConnectorSidecarManager {
  private static instance: ConnectorSidecarManager;
  private proc: ChildProcess | null = null;
  private stopping = false;
  private lastConfig: ConnectorSidecarStartConfig | null = null;
  private resolvedEntryPath: string | null | undefined;

  static getInstance(): ConnectorSidecarManager {
    if (!ConnectorSidecarManager.instance) {
      ConnectorSidecarManager.instance = new ConnectorSidecarManager();
    }
    return ConnectorSidecarManager.instance;
  }

  /** Start the connector sidecar. Returns its base URL. Idempotent. */
  async start(config: ConnectorSidecarStartConfig): Promise<string> {
    this.lastConfig = config;
    if (this.proc) {
      return this.getUrl();
    }

    const entryPath = this.resolveEntryPath();
    if (!entryPath) {
      log.warn(
        '[ConnectorSidecarManager] services/open-connector not found — connector-backed ' +
          'Lens sources (GitHub, Notion, Linear, etc via the sidecar) will be unavailable. ' +
          'Run the desktop build pipeline to bundle resources/connector-sidecar/.'
      );
      throw new Error('connector sidecar source not found');
    }

    const dataDir = path.join(app.getPath('userData'), 'connector-sidecar-data');

    const env: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][]
      ),
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(SIDECAR_PORT),
      HOST: '127.0.0.1',
      OOMOL_CONNECT_ORIGIN: URLS.API,
      OOMOL_CONNECT_DATA_DIR: dataDir,
      OOMOL_CONNECT_ENCRYPTION_KEY: config.encryptionKey,
      OOMOL_CONNECT_ADMIN_TOKEN: config.adminToken,
      OOMOL_CONNECT_RUNTIME_TOKEN: config.runtimeToken,
    };

    log.info(`[ConnectorSidecarManager] Starting open-connector on port ${SIDECAR_PORT} from ${entryPath}`);

    const proc = spawn(process.execPath, [entryPath], {
      env,
      cwd: path.dirname(entryPath).replace(/\/src\/server$/, ''),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.proc = proc;

    proc.stdout?.on('data', (d: Buffer) => log.info('[ConnectorSidecar]', d.toString().trim()));
    proc.stderr?.on('data', (d: Buffer) => log.warn('[ConnectorSidecar]', d.toString().trim()));
    proc.on('exit', (code) => {
      log.warn(`[ConnectorSidecarManager] exited (code ${code})`);
      const intentionalStop = this.stopping;
      this.stopping = false;
      if (this.proc === proc) this.proc = null;

      if (!intentionalStop && this.lastConfig && (app.isPackaged || process.env.NODE_ENV === 'production')) {
        log.info('[ConnectorSidecarManager] Connector sidecar crashed unexpectedly, respawning in 1s...');
        setTimeout(() => {
          if (this.lastConfig) {
            this.start(this.lastConfig).catch((e) =>
              log.error('[ConnectorSidecarManager] Failed to auto-restart connector sidecar:', e)
            );
          }
        }, 1000);
      }
    });

    await this.waitUntilReady();
    log.info(`[ConnectorSidecarManager] Ready at ${this.getUrl()}`);
    return this.getUrl();
  }

  stop(): void {
    this.lastConfig = null;
    if (this.proc) {
      log.info('[ConnectorSidecarManager] Stopping…');
      this.stopping = true;
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${SIDECAR_PORT}`;
  }

  isRunning(): boolean {
    return this.proc !== null;
  }

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    const url = `${this.getUrl()}/health`;
    while (Date.now() < deadline) {
      if (!this.proc) {
        throw new Error('connector sidecar exited before becoming ready');
      }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`connector sidecar did not start within ${HEALTH_TIMEOUT_MS / 1000}s`);
  }

  private resolveEntryPath(): string | null {
    if (this.resolvedEntryPath !== undefined) {
      return this.resolvedEntryPath;
    }

    const candidates = app.isPackaged
      ? [path.join(process.resourcesPath ?? '', 'connector-sidecar', 'src', 'server', 'index.ts')]
      : [
          path.join(app.getAppPath(), '..', '..', 'services', 'open-connector', 'src', 'server', 'index.ts'),
        ];

    for (const candidate of candidates) {
      try {
        if (require('fs').existsSync(candidate)) {
          this.resolvedEntryPath = candidate;
          return candidate;
        }
      } catch {
        // keep checking
      }
    }
    this.resolvedEntryPath = null;
    return null;
  }
}

export const connectorSidecarManager = ConnectorSidecarManager.getInstance();
