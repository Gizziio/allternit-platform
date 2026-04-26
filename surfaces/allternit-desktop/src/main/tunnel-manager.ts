/**
 * Allternit Desktop — Cloudflare Tunnel Manager
 *
 * Manages an on-demand Cloudflare Tunnel that exposes the local allternit-api
 * (port 8013) to the web platform at platform.allternit.com.
 *
 * Flow:
 *   1. User clicks "Enable Web Access" in the desktop app
 *   2. TunnelManager spawns cloudflared pointing at http://localhost:8013
 *   3. Parses the assigned public URL from cloudflared's stderr output
 *   4. Generates a one-time session token
 *   5. Opens platform.allternit.com/connect?tunnelUrl=xxx&token=yyy in the browser
 *   6. Web platform stores the tunnel URL, routes all API calls through it
 *   7. User clicks "Disable Web Access" → tunnel stops, URL expires
 *
 * Binary resolution (in order):
 *   - resources/bin/cloudflared  (bundled in packaged app)
 *   - PATH cloudflared           (system-installed, dev mode)
 */

import { app, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import log from 'electron-log';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLATFORM_CONNECT_URL = 'https://platform.allternit.com/connect';
const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const TUNNEL_READY_TIMEOUT_MS = 30_000;

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelState {
  status: TunnelStatus;
  url?: string;
  error?: string;
}

export class TunnelManager {
  private static instance: TunnelManager;
  private proc: ChildProcess | null = null;
  private tunnelUrl: string | null = null;
  private sessionToken: string | null = null;
  private status: TunnelStatus = 'stopped';
  private statusListeners: Array<(state: TunnelState) => void> = [];

  static getInstance(): TunnelManager {
    if (!TunnelManager.instance) {
      TunnelManager.instance = new TunnelManager();
    }
    return TunnelManager.instance;
  }

  /**
   * Start the tunnel pointing at allternit-api (port 8013).
   * Resolves with the public tunnel URL once cloudflared is ready.
   */
  async start(): Promise<string> {
    if (this.proc && this.tunnelUrl) {
      return this.tunnelUrl;
    }

    const binaryPath = this.resolveBinaryPath();
    if (!binaryPath) {
      throw new Error(
        'cloudflared not found. Install it via:\n' +
        '  brew install cloudflared\n' +
        'or add it to resources/bin/cloudflared'
      );
    }

    this.sessionToken = crypto.randomBytes(32).toString('hex');
    this.setStatus('starting');

    log.info('[TunnelManager] Starting cloudflared tunnel to http://localhost:8013');

    this.proc = spawn(binaryPath, ['tunnel', '--url', 'http://localhost:8013'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // cloudflared prints the tunnel URL to stderr
    const url = await this.waitForUrl();
    this.tunnelUrl = url;
    this.setStatus('running');

    log.info(`[TunnelManager] Tunnel ready at ${url}`);

    this.proc.stderr?.on('data', (d: Buffer) =>
      log.info('[cloudflared]', d.toString().trim())
    );

    this.proc.on('exit', (code) => {
      log.warn(`[TunnelManager] cloudflared exited (code ${code})`);
      this.proc = null;
      this.tunnelUrl = null;
      this.sessionToken = null;
      this.setStatus(code === 0 ? 'stopped' : 'error');
    });

    return url;
  }

  /**
   * Start tunnel and open platform.allternit.com/connect in the browser.
   * This is the full "Enable Web Access" flow.
   */
  async enableWebAccess(): Promise<string> {
    const url = await this.start();
    // Give cloudflared a moment to fully register before opening browser
    await new Promise(r => setTimeout(r, 800));
    const connectUrl = this.buildConnectUrl(url);
    log.info('[TunnelManager] Opening browser to', connectUrl);
    await shell.openExternal(connectUrl);
    return url;
  }

  stop(): void {
    if (this.proc) {
      log.info('[TunnelManager] Stopping tunnel…');
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.tunnelUrl = null;
      this.sessionToken = null;
      this.setStatus('stopped');
    }
  }

  getState(): TunnelState {
    return {
      status: this.status,
      url: this.tunnelUrl ?? undefined,
    };
  }

  getUrl(): string | null {
    return this.tunnelUrl;
  }

  getToken(): string | null {
    return this.sessionToken;
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  onStatusChange(listener: (state: TunnelState) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private setStatus(status: TunnelStatus): void {
    this.status = status;
    const state = this.getState();
    this.statusListeners.forEach(l => l(state));
  }

  private buildConnectUrl(tunnelUrl: string): string {
    const params = new URLSearchParams({
      tunnelUrl: tunnelUrl.replace('https://', ''),
      token: this.sessionToken ?? '',
    });
    return `${PLATFORM_CONNECT_URL}?${params.toString()}`;
  }

  private async waitForUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        reject(new Error(`cloudflared did not provide a tunnel URL within ${TUNNEL_READY_TIMEOUT_MS / 1000}s`));
      }, TUNNEL_READY_TIMEOUT_MS);

      let buffer = '';

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        const match = buffer.match(TUNNEL_URL_PATTERN);
        if (match) {
          clearTimeout(deadline);
          this.proc?.stderr?.off('data', onData);
          resolve(match[0]);
        }
      };

      this.proc?.stderr?.on('data', onData);

      this.proc?.on('error', (err) => {
        clearTimeout(deadline);
        reject(new Error(`cloudflared failed to start: ${err.message}`));
      });

      this.proc?.on('exit', (code) => {
        clearTimeout(deadline);
        reject(new Error(`cloudflared exited prematurely (code ${code})`));
      });
    });
  }

  private resolveBinaryPath(): string | null {
    const binaryName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';

    const candidates = [
      // Packaged app — bundled in resources/bin/
      path.join(process.resourcesPath ?? '', 'bin', binaryName),
      // Fallback: resources/bin relative to desktop dir
      path.join(__dirname, '..', '..', 'resources', 'bin', binaryName),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        log.info(`[TunnelManager] Found cloudflared at: ${p}`);
        return p;
      }
    }

    // Last resort: system PATH (dev mode)
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const result = execSync(`${which} ${binaryName}`, { encoding: 'utf8' }).trim().split('\n')[0];
      if (result) {
        log.info(`[TunnelManager] Using system cloudflared at: ${result}`);
        return result;
      }
    } catch {
      // not on PATH
    }

    log.error('[TunnelManager] cloudflared not found. Searched:', candidates, '+ PATH');
    return null;
  }
}

export const tunnelManager = TunnelManager.getInstance();
