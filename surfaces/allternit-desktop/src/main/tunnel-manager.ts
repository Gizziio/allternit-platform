/**
 * Web Access compatibility facade.
 *
 * Web access is now provided by the paired runtime's outbound authenticated
 * relay. The old quick Cloudflare tunnel embedded an unbound bearer secret in
 * a browser URL and made the website call a temporary public localhost proxy.
 * Existing UI controls keep working, but they now open the canonical platform
 * where the already-paired runtime is selected automatically.
 */

import { shell } from 'electron';
import log from 'electron-log';
import { URLS } from './config.js';

export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelState {
  status: TunnelStatus;
  url?: string;
  error?: string;
}

export class TunnelManager {
  private static instance: TunnelManager;
  private status: TunnelStatus = 'stopped';
  private statusListeners: Array<(state: TunnelState) => void> = [];

  static getInstance(): TunnelManager {
    if (!TunnelManager.instance) TunnelManager.instance = new TunnelManager();
    return TunnelManager.instance;
  }

  async start(): Promise<string> {
    this.setStatus('running');
    log.info('[WebAccess] Paired outbound runtime relay enabled');
    return URLS.PLATFORM;
  }

  async enableWebAccess(): Promise<string> {
    const url = await this.start();
    await shell.openExternal(url);
    return url;
  }

  stop(): void {
    this.setStatus('stopped');
  }

  getState(): TunnelState {
    return { status: this.status, url: this.isRunning() ? URLS.PLATFORM : undefined };
  }

  getUrl(): string | null {
    return this.isRunning() ? URLS.PLATFORM : null;
  }

  /** Legacy API: relay credentials are never returned to renderer code. */
  getToken(): null {
    return null;
  }

  isRunning(): boolean {
    return this.status === 'running';
  }

  onStatusChange(listener: (state: TunnelState) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((candidate) => candidate !== listener);
    };
  }

  private setStatus(status: TunnelStatus): void {
    this.status = status;
    const state = this.getState();
    for (const listener of this.statusListeners) listener(state);
  }
}

export const tunnelManager = TunnelManager.getInstance();
