/**
 * Platform Server Manager — stub
 *
 * Desktop now loads ai.allternit.com (Cloudflare Pages) remotely.
 * There is no local Next.js standalone server to manage.
 * This module is kept as a no-op so call sites in unified-main.ts
 * (platformServerManager.stop()) continue to compile without changes.
 */

import log from 'electron-log';

export interface PlatformServerConfig {
  apiUrl: string;
  apiKey: string;
  gizziUrl?: string;
  gizziPassword?: string;
}

class PlatformServerManager {
  private static instance: PlatformServerManager;

  static getInstance(): PlatformServerManager {
    if (!PlatformServerManager.instance) {
      PlatformServerManager.instance = new PlatformServerManager();
    }
    return PlatformServerManager.instance;
  }

  async start(_config: PlatformServerConfig): Promise<string> {
    log.info('[PlatformServer] No-op — desktop loads ai.allternit.com remotely');
    return 'https://ai.allternit.com';
  }

  stop(): void {
    // No-op — no local process to kill
  }

  getUrl(): string | null {
    return 'https://ai.allternit.com';
  }
}

export const platformServerManager = PlatformServerManager.getInstance();
