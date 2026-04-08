/**
 * Browser Client Integration
 * 
 * ⚠️ ARCHITECTURE COMPLIANCE: All calls go through Gateway (port 8013)
 * UI → Gateway (8013) → API (3000) → Kernel (3004) → Browser Server (9222)
 * 
 * NEVER connect directly to Browser Server or Kernel from UI.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  getRuntimeGatewayBaseUrl,
  getRuntimeGatewayBaseUrlSync,
} from '@/lib/runtime-backend-client';

const API_VERSION = '/api/v1';
const BROWSER_GATEWAY_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_BROWSER_GATEWAY !== 'false';

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface BrowserStatus {
  enabled: boolean;
  profile: string;
  running: boolean;
  cdpReady: boolean;
  cdpHttp: boolean;
  pid: number | null;
  cdpPort: number;
  cdpUrl: string;
}

export interface BrowserTab {
  targetId: string;
  url: string;
  title: string;
  type: 'page' | 'background_page' | 'service_worker';
}

export interface SnapshotOptions {
  format?: 'ai' | 'aria';
  targetId?: string;
  labels?: boolean;
  mode?: 'efficient';
  maxChars?: number;
}

export interface SnapshotResult {
  ok: true;
  format: 'ai' | 'aria';
  targetId: string;
  url: string;
  snapshot: string;
  refs?: Record<string, string>;
  imagePath?: string;
}

export interface ScreenshotOptions {
  targetId?: string;
  fullPage?: boolean;
  ref?: string;
  element?: string;
  type?: 'png' | 'jpeg';
}

export interface ActOptions {
  kind: 'click' | 'type' | 'press' | 'hover' | 'scrollIntoView' | 'drag' | 'select' | 'fill' | 'wait' | 'evaluate' | 'close';
  targetId?: string;
  ref?: string;
  text?: string;
  key?: string;
  timeoutMs?: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// Gateway API Client
// ═════════════════════════════════════════════════════════════════════════════

class BrowserGatewayClient {
  private async gatewayRequest(
    tool: string,
    params: Record<string, unknown>
  ): Promise<any> {
    const gatewayUrl = await getRuntimeGatewayBaseUrl();
    const response = await fetch(`${gatewayUrl}${API_VERSION}/gateway/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool,
        params,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gateway error: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.payload;
  }

  // Status - via browser.status gateway command
  async getStatus(profile?: string): Promise<BrowserStatus> {
    return this.gatewayRequest('browser.status', { profile });
  }

  // Profiles - via browser.proxy gateway command
  async getProfiles(): Promise<{ profiles: Array<{ name: string; color?: string; cdpPort: number }> }> {
    return this.gatewayRequest('browser.proxy', {
      method: 'GET',
      path: '/profiles',
    });
  }

  // Browser Control - via browser.start/stop gateway commands
  async startBrowser(profile?: string): Promise<void> {
    await this.gatewayRequest('browser.start', { profile });
  }

  async stopBrowser(profile?: string): Promise<void> {
    await this.gatewayRequest('browser.stop', { profile });
  }

  // Tabs - via browser.proxy gateway command
  async getTabs(profile?: string): Promise<{ tabs: BrowserTab[] }> {
    return this.gatewayRequest('browser.proxy', {
      method: 'GET',
      path: '/tabs',
      profile,
    });
  }

  async openTab(url: string, profile?: string): Promise<{ ok: true; tab: BrowserTab }> {
    return this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/tabs/open',
      body: { url },
      profile,
    });
  }

  async closeTab(targetId: string, profile?: string): Promise<void> {
    await this.gatewayRequest('browser.proxy', {
      method: 'DELETE',
      path: `/tabs/${encodeURIComponent(targetId)}`,
      profile,
    });
  }

  async focusTab(targetId: string, profile?: string): Promise<void> {
    await this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/tabs/focus',
      body: { targetId },
      profile,
    });
  }

  // Navigation - via browser.proxy gateway command
  async navigate(url: string, targetId?: string, profile?: string): Promise<void> {
    await this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/navigate',
      body: { url, targetId },
      profile,
    });
  }

  // Snapshot - via browser.proxy gateway command
  async getSnapshot(options: SnapshotOptions = {}, profile?: string): Promise<SnapshotResult> {
    const query: Record<string, string> = {
      format: options.format || 'ai',
    };
    if (options.targetId) query.targetId = options.targetId;
    if (options.labels) query.labels = 'true';
    if (options.mode) query.mode = options.mode;
    if (options.maxChars) query.maxChars = options.maxChars.toString();

    return this.gatewayRequest('browser.proxy', {
      method: 'GET',
      path: '/snapshot',
      query,
      profile,
    });
  }

  // Screenshot - via browser.proxy gateway command
  async takeScreenshot(options: ScreenshotOptions = {}, profile?: string): Promise<{ ok: true; path: string; targetId: string; url: string }> {
    return this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/screenshot',
      body: options,
      profile,
    });
  }

  // Actions - via browser.proxy gateway command
  async act(action: ActOptions, profile?: string): Promise<void> {
    await this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/act',
      body: action,
      profile,
    });
  }

  // PDF - via browser.proxy gateway command
  async savePDF(targetId?: string, profile?: string): Promise<{ ok: true; path: string; targetId: string; url: string }> {
    return this.gatewayRequest('browser.proxy', {
      method: 'POST',
      path: '/pdf',
      body: { targetId },
      profile,
    });
  }
}

export const browserClient = new BrowserGatewayClient();

// ═════════════════════════════════════════════════════════════════════════════
// Canvas Gateway Client
// ═════════════════════════════════════════════════════════════════════════════

class CanvasGatewayClient {
  private async gatewayRequest(
    tool: string,
    params: Record<string, unknown>
  ): Promise<any> {
    const gatewayUrl = await getRuntimeGatewayBaseUrl();
    const response = await fetch(`${gatewayUrl}${API_VERSION}/gateway/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool,
        params,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gateway error: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return data.payload;
  }

  // Canvas Commands - via canvas.* gateway commands
  async present(url?: string, placement?: { x?: number; y?: number; width?: number; height?: number }): Promise<void> {
    await this.gatewayRequest('canvas.present', { url, placement });
  }

  async hide(): Promise<void> {
    await this.gatewayRequest('canvas.hide', {});
  }

  async navigate(url: string): Promise<void> {
    await this.gatewayRequest('canvas.navigate', { url });
  }

  async eval(javaScript: string): Promise<{ result?: unknown }> {
    return this.gatewayRequest('canvas.eval', { javaScript });
  }

  async snapshot(format: 'png' | 'jpeg' = 'png', options?: { maxWidth?: number; quality?: number }): Promise<{ path: string }> {
    return this.gatewayRequest('canvas.snapshot', { format, ...options });
  }

  async a2uiPush(jsonl: string): Promise<void> {
    await this.gatewayRequest('canvas.a2ui.pushJSONL', { jsonl });
  }

  async a2uiReset(): Promise<void> {
    await this.gatewayRequest('canvas.a2ui.reset', {});
  }

  // Canvas Host URL (direct for iframe, actions go through gateway)
  getHostUrl(): string {
    // Canvas host URL for iframe (read-only, no actions)
    return process.env.NEXT_PUBLIC_CANVAS_URL || 'http://127.0.0.1:8080';
  }

  getA2UIUrl(): string {
    return `${this.getHostUrl()}/__allternit__/a2ui`;
  }
}

export const canvasClient = new CanvasGatewayClient();

// ═════════════════════════════════════════════════════════════════════════════
// React Hooks
// ═════════════════════════════════════════════════════════════════════════════

export function useBrowserStatus(profile?: string) {
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!BROWSER_GATEWAY_ENABLED) {
      setStatus(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await browserClient.getStatus(profile);
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!BROWSER_GATEWAY_ENABLED) {
      return;
    }

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const start = useCallback(async () => {
    if (!BROWSER_GATEWAY_ENABLED) {
      return;
    }

    setLoading(true);
    try {
      await browserClient.startBrowser(profile);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [profile, refresh]);

  const stop = useCallback(async () => {
    if (!BROWSER_GATEWAY_ENABLED) {
      return;
    }

    setLoading(true);
    try {
      await browserClient.stopBrowser(profile);
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [profile, refresh]);

  return { status, loading, error, refresh, start, stop };
}

export function useBrowserTabs(profile?: string) {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!BROWSER_GATEWAY_ENABLED) {
      setTabs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await browserClient.getTabs(profile);
      setTabs(data.tabs);
    } catch {
      setTabs([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!BROWSER_GATEWAY_ENABLED) {
      return;
    }

    refresh();
  }, [refresh]);

  const openTab = useCallback(async (url: string) => {
    const result = await browserClient.openTab(url, profile);
    await refresh();
    return result.tab;
  }, [profile, refresh]);

  const closeTab = useCallback(async (targetId: string) => {
    await browserClient.closeTab(targetId, profile);
    await refresh();
  }, [profile, refresh]);

  const focusTab = useCallback(async (targetId: string) => {
    await browserClient.focusTab(targetId, profile);
    await refresh();
  }, [profile, refresh]);

  return { tabs, loading, refresh, openTab, closeTab, focusTab };
}

export function useBrowserSnapshot(profile?: string) {
  const [snapshot, setSnapshot] = useState<SnapshotResult | null>(null);
  const [loading, setLoading] = useState(false);

  const takeSnapshot = useCallback(async (options: SnapshotOptions = {}) => {
    setLoading(true);
    try {
      const data = await browserClient.getSnapshot(options, profile);
      setSnapshot(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [profile]);

  return { snapshot, loading, takeSnapshot };
}

export function useBrowserAutomation(profile?: string) {
  const { status, loading: statusLoading, start, stop } = useBrowserStatus(profile);
  const { tabs, loading: tabsLoading, refresh: refreshTabs, openTab, closeTab, focusTab } = useBrowserTabs(profile);
  const { snapshot, loading: snapshotLoading, takeSnapshot } = useBrowserSnapshot(profile);

  const navigate = useCallback(async (url: string, targetId?: string) => {
    await browserClient.navigate(url, targetId, profile);
  }, [profile]);

  const executeAction = useCallback(async (action: ActOptions) => {
    await browserClient.act(action, profile);
  }, [profile]);

  const takeScreenshot = useCallback(async (options: ScreenshotOptions = {}) => {
    return browserClient.takeScreenshot(options, profile);
  }, [profile]);

  return {
    status,
    isLoading: statusLoading || tabsLoading || snapshotLoading,
    isRunning: status?.running ?? false,
    start,
    stop,
    tabs,
    refreshTabs,
    openTab,
    closeTab,
    focusTab,
    navigate,
    snapshot,
    takeSnapshot,
    executeAction,
    takeScreenshot,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Canvas Host Hook
// ═════════════════════════════════════════════════════════════════════════════

export function useCanvasHost() {
  const [isReady, setIsReady] = useState(false);
  const [isPresented, setIsPresented] = useState(false);

  useEffect(() => {
    if (!BROWSER_GATEWAY_ENABLED) {
      setIsReady(false);
      return;
    }

    // Check if canvas host is available
    const checkReady = async () => {
      try {
        const response = await fetch(`${getRuntimeGatewayBaseUrlSync()}${API_VERSION}/gateway/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'canvas.present',
            params: { url: 'about:blank' }
          })
        });
        setIsReady(response.ok);
      } catch {
        setIsReady(false);
      }
    };
    checkReady();
  }, []);

  const present = useCallback(async (url?: string, placement?: { x?: number; y?: number; width?: number; height?: number }) => {
    await canvasClient.present(url, placement);
    setIsPresented(true);
  }, []);

  const hide = useCallback(async () => {
    await canvasClient.hide();
    setIsPresented(false);
  }, []);

  const pushA2UI = useCallback(async (jsonl: string) => {
    await canvasClient.a2uiPush(jsonl);
  }, []);

  const navigate = useCallback(async (url: string) => {
    await canvasClient.navigate(url);
  }, []);

  return {
    isReady,
    isPresented,
    present,
    hide,
    pushA2UI,
    navigate,
  };
}

export default browserClient;
