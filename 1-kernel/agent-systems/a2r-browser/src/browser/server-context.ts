/**
 * Browser Server Context
 * Ported from OpenClaw dist/browser/server-context.js
 */

import type { BrowserConfig, BrowserProfile, BrowserState, BrowserTab, ProfileState } from '../types/index.js';

export interface BrowserRouteContextOptions {
  getState: () => BrowserState | null;
}

export interface ProfileContext {
  profile: BrowserProfile;
  isHttpReachable(timeoutMs: number): Promise<boolean>;
  isReachable(timeoutMs: number): Promise<boolean>;
  ensureBrowserAvailable(): Promise<void>;
  stopRunningBrowser(): Promise<{ stopped: boolean }>;
  resetProfile(): Promise<{ reset: boolean }>;
  ensureTabAvailable(targetId?: string): Promise<BrowserTab>;
}

export function createBrowserRouteContext(opts: BrowserRouteContextOptions) {
  const { getState } = opts;

  function resolveProfileContext(
    req: { query?: { profile?: string }; body?: { profile?: string } },
    res: { status: (code: number) => any; json: (data: any) => void },
    ctx: ReturnType<typeof createBrowserRouteContext>
  ): ProfileContext | null {
    const state = ctx.state();
    if (!state) {
      res.status(503).json({ error: 'Browser server not started' });
      return null;
    }

    const profileName = req.query?.profile || req.body?.profile || 'default';
    const profile = state.resolved.profiles[profileName];
    
    if (!profile) {
      res.status(400).json({ error: `Unknown profile: ${profileName}` });
      return null;
    }

    return createProfileContext(profile, state);
  }

  function createProfileContext(profile: BrowserProfile, state: BrowserState): ProfileContext {
    return {
      profile,
      
      async isHttpReachable(timeoutMs: number): Promise<boolean> {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          const response = await fetch(profile.cdpUrl, { 
            signal: controller.signal 
          });
          clearTimeout(timeout);
          return response.ok;
        } catch {
          return false;
        }
      },

      async isReachable(timeoutMs: number): Promise<boolean> {
        // Check if browser process is running
        const profileState = state.profiles.get(profile.name);
        if (!profileState?.running) return false;
        
        // Also check HTTP endpoint
        return this.isHttpReachable(timeoutMs);
      },

      async ensureBrowserAvailable(): Promise<void> {
        const isRunning = await this.isReachable(1000);
        if (isRunning) return;

        // Start browser using CDP
        const { launchBrowser } = await import('./playwright/launcher.js');
        const running = await launchBrowser({
          profile,
          headless: state.resolved.headless,
          noSandbox: state.resolved.noSandbox,
          executablePath: state.resolved.executablePath,
        });

        state.profiles.set(profile.name, { running });
      },

      async stopRunningBrowser(): Promise<{ stopped: boolean }> {
        const profileState = state.profiles.get(profile.name);
        if (!profileState?.running) return { stopped: false };

        // Kill browser process
        try {
          process.kill(profileState.running.pid, 'SIGTERM');
          state.profiles.delete(profile.name);
          return { stopped: true };
        } catch {
          return { stopped: false };
        }
      },

      async resetProfile(): Promise<{ reset: boolean }> {
        await this.stopRunningBrowser();
        // Clear user data directory
        if (profile.userDataDir) {
          const { rm } = await import('fs/promises');
          try {
            await rm(profile.userDataDir, { recursive: true });
          } catch {
            // Ignore errors
          }
        }
        return { reset: true };
      },

      async ensureTabAvailable(targetId?: string): Promise<BrowserTab> {
        await this.ensureBrowserAvailable();
        
        const { getTabs, openTab } = await import('./cdp/tabs.js');
        const tabs = await getTabs(profile.cdpUrl);
        
        if (targetId) {
          const tab = tabs.find(t => t.targetId === targetId);
          if (tab) return tab;
          throw new Error(`Tab not found: ${targetId}`);
        }
        
        // Return first tab or create new one
        if (tabs.length > 0) return tabs[0];
        return openTab(profile.cdpUrl, 'about:blank');
      },
    };
  }

  return {
    state: getState,
    resolveProfileContext,
  };
}
