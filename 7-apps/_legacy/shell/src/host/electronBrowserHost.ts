/**
 * Electron Browser Host
 *
 * Bridges the gap between the React UI (Capsule SDK) and the Electron IPC API.
 * Provides a clean async interface to window.a2Browser for browser operations.
 *
 * Usage:
 *   import { electronBrowserHost } from './host/electronBrowserHost';
 *
 *   // Create a browser tab
 *   const { tabId } = await electronBrowserHost.createTab('https://example.com');
 *
 *   // Navigate
 *   await electronBrowserHost.navigate(tabId, 'https://google.com');
 *
 *   // Subscribe to events
 *   const unsubscribe = electronBrowserHost.onDidNavigate((event) => {
 *     console.log(`Navigated to ${event.url}`);
 *   });
 */

/// <reference path="./electron.d.ts" />

import type {
  DidNavigateEvent,
  TitleUpdatedEvent,
  DidFailLoadEvent,
  DidFinishLoadEvent,
  NewTabRequestedEvent,
  StageAttachedEvent,
  NavIntent,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface BrowserHostConfig {
  /** Default URL for new tabs */
  defaultUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface CreateTabResult {
  tabId: string;
  success: boolean;
  error?: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
}

// ============================================================================
// Electron Browser Host
// ============================================================================

export class ElectronBrowserHost {
  private config: BrowserHostConfig;
  private isInitialized: boolean = false;
  private eventSubscriptions: Map<string, Set<Function>> = new Map();
  private stageTabId: string | null = null;
  private tabIntents: Map<string, NavIntent> = new Map();

  constructor(config: BrowserHostConfig = {}) {
    this.config = {
      defaultUrl: 'about:blank',
      debug: false,
      ...config,
    };
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize the browser host
   * Should be called once when the app starts
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.warn('Browser host already initialized');
      return;
    }

    // Wait for window.a2Browser to be available
    await this.waitForA2Browser();

    // Set up internal event forwarding
    this.setupEventForwarding();

    this.isInitialized = true;
    this.log('Browser host initialized');
  }

  /**
   * Check if running in Electron environment
   */
  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'a2Browser' in window;
  }

  // ========================================================================
  // Tab Management
  // ========================================================================

  /**
   * Create a new browser tab
   * @param url - Initial URL for the tab
   * @param intent - Navigation intent ("user" for human, "agent" for automation). Defaults to "user".
   */
  async createTab(url?: string, intent: NavIntent = 'user'): Promise<CreateTabResult> {
    const targetUrl = url || this.config.defaultUrl || 'about:blank';

    try {
      const result = await window.a2Browser.createTab(targetUrl);
      if (result.success && result.tabId) {
        this.tabIntents.set(result.tabId, intent);
        this.log(`Created tab: ${result.tabId} for ${targetUrl} [intent: ${intent}]`);
      }
      return result;
    } catch (error) {
      this.error('Failed to create tab', error);
      return {
        tabId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close a browser tab
   */
  async closeTab(tabId: string): Promise<void> {
    try {
      await window.a2Browser.closeTab(tabId);
      this.tabIntents.delete(tabId);
      if (this.stageTabId === tabId) {
        this.stageTabId = null;
      }
      this.log(`Closed tab: ${tabId}`);
    } catch (error) {
      this.error(`Failed to close tab: ${tabId}`, error);
      throw error;
    }
  }

  /**
   * Get all open tabs
   */
  async getTabs(): Promise<TabInfo[]> {
    try {
      return await window.a2Browser.getTabs();
    } catch (error) {
      this.error('Failed to get tabs', error);
      return [];
    }
  }

  /**
   * Get the current stage tab ID
   */
  async getStageTabId(): Promise<string | null> {
    try {
      return await window.a2Browser.getStageTabId();
    } catch (error) {
      this.error('Failed to get stage tab ID', error);
      return null;
    }
  }

  /**
   * Get the navigation intent for a tab
   */
  getTabIntent(tabId: string): NavIntent {
    return this.tabIntents.get(tabId) || 'user';
  }

  /**
   * Set the navigation intent for a tab
   */
  setTabIntent(tabId: string, intent: NavIntent): void {
    this.tabIntents.set(tabId, intent);
  }

  // ========================================================================
  // Navigation
  // ========================================================================

  /**
   * Navigate a tab to a URL
   * @param tabId - Target tab ID
   * @param url - URL to navigate to
   * @param intent - Navigation intent ("user" for human, "agent" for automation). Defaults to "user".
   */
  async navigate(tabId: string, url: string, intent: NavIntent = 'user'): Promise<void> {
    try {
      await window.a2Browser.navigate(tabId, url);
      this.tabIntents.set(tabId, intent);
      this.log(`Navigated tab ${tabId} to ${url} [intent: ${intent}]`);
    } catch (error) {
      this.error(`Failed to navigate tab ${tabId} to ${url}`, error);
      throw error;
    }
  }

  /**
   * Go back in history
   */
  async goBack(tabId: string): Promise<void> {
    try {
      await window.a2Browser.goBack(tabId);
      this.log(`Go back in tab ${tabId}`);
    } catch (error) {
      this.error(`Failed to go back in tab ${tabId}`, error);
    }
  }

  /**
   * Go forward in history
   */
  async goForward(tabId: string): Promise<void> {
    try {
      await window.a2Browser.goForward(tabId);
      this.log(`Go forward in tab ${tabId}`);
    } catch (error) {
      this.error(`Failed to go forward in tab ${tabId}`, error);
    }
  }

  /**
   * Reload the page
   */
  async reload(tabId: string): Promise<void> {
    try {
      await window.a2Browser.reload(tabId);
      this.log(`Reload tab ${tabId}`);
    } catch (error) {
      this.error(`Failed to reload tab ${tabId}`, error);
    }
  }

  // ========================================================================
  // Stage Management
  // ========================================================================

  /**
   * Attach a tab to the stage with bounds
   */
  async attachStage(tabId: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void> {
    try {
      await window.a2Browser.attachStage(tabId, bounds);
      this.stageTabId = tabId;
      this.log(`Attached tab ${tabId} to stage with bounds:`, bounds);
    } catch (error) {
      this.error(`Failed to attach tab ${tabId} to stage`, error);
      throw error;
    }
  }

  /**
   * Detach a tab from the stage
   */
  async detachStage(tabId: string): Promise<void> {
    try {
      await window.a2Browser.detachStage(tabId);
      if (this.stageTabId === tabId) {
        this.stageTabId = null;
      }
      this.log(`Detached tab ${tabId} from stage`);
    } catch (error) {
      this.error(`Failed to detach tab ${tabId} from stage`, error);
      throw error;
    }
  }

  /**
   * Update stage bounds
   */
  async setStageBounds(tabId: string, bounds: { x: number; y: number; width: number; height: number }): Promise<void> {
    try {
      await window.a2Browser.setStageBounds(tabId, bounds);
      this.log(`Updated stage bounds for tab ${tabId}:`, bounds);
    } catch (error) {
      this.error(`Failed to update stage bounds for tab ${tabId}`, error);
      throw error;
    }
  }

  // ========================================================================
  // Event Subscriptions
  // ========================================================================

  /**
   * Subscribe to navigation events
   */
  onDidNavigate(callback: (event: DidNavigateEvent) => void): () => void {
    return window.a2Browser.onDidNavigate(callback);
  }

  /**
   * Subscribe to title update events
   */
  onTitleUpdated(callback: (event: TitleUpdatedEvent) => void): () => void {
    return window.a2Browser.onTitleUpdated(callback);
  }

  /**
   * Subscribe to load failure events
   */
  onDidFailLoad(callback: (event: DidFailLoadEvent) => void): () => void {
    return window.a2Browser.onDidFailLoad(callback);
  }

  /**
   * Subscribe to load finish events
   */
  onDidFinishLoad(callback: (event: DidFinishLoadEvent) => void): () => void {
    return window.a2Browser.onDidFinishLoad(callback);
  }

  /**
   * Subscribe to new tab requests
   */
  onNewTabRequested(callback: (event: NewTabRequestedEvent) => void): () => void {
    return window.a2Browser.onNewTabRequested(callback);
  }

  /**
   * Subscribe to stage attached events
   */
  onStageAttached(callback: (event: StageAttachedEvent) => void): () => void {
    return window.a2Browser.onStageAttached(callback);
  }

  /**
   * Subscribe to stage detached events
   */
  onStageDetached(callback: (event: { tabId: string }) => void): () => void {
    return window.a2Browser.onStageDetached(callback);
  }

  /**
   * Subscribe to stage bounds changed events
   */
  onStageBoundsChanged(callback: (event: StageAttachedEvent) => void): () => void {
    return window.a2Browser.onStageBoundsChanged(callback);
  }

  /**
   * Subscribe to tab closed events
   */
  onTabClosed(callback: (event: { tabId: string }) => void): () => void {
    return window.a2Browser.onTabClosed(callback);
  }

  // ========================================================================
  // Shell Operations (future use)
  // ========================================================================

  /**
   * Get the shell version
   */
  async getVersion(): Promise<string> {
    if ('a2Shell' in window) {
      return window.a2Shell.getVersion();
    }
    return 'unknown';
  }

  /**
   * Quit the application
   */
  async quit(): Promise<void> {
    if ('a2Shell' in window) {
      return window.a2Shell.quit();
    }
  }

  /**
   * Minimize the window
   */
  async minimize(): Promise<void> {
    if ('a2Shell' in window) {
      return window.a2Shell.minimize();
    }
  }

  /**
   * Maximize the window
   */
  async maximize(): Promise<void> {
    if ('a2Shell' in window) {
      return window.a2Shell.maximize();
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Wait for window.a2Browser to be available
   */
  private async waitForA2Browser(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.isAvailable()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error('window.a2Browser not available after timeout');
  }

  /**
   * Set up internal event forwarding
   */
  private setupEventForwarding(): void {
    // Forward all events to internal subscribers
    this.onDidNavigate((event) => {
      this.emit('didNavigate', event);
    });

    this.onTitleUpdated((event) => {
      this.emit('titleUpdated', event);
    });

    this.onDidFailLoad((event) => {
      this.emit('didFailLoad', event);
    });

    this.onDidFinishLoad((event) => {
      this.emit('didFinishLoad', event);
    });

    this.onStageAttached((event) => {
      this.emit('stageAttached', event);
    });

    this.onStageDetached((event) => {
      this.emit('stageDetached', event);
    });

    this.onTabClosed((event) => {
      this.emit('tabClosed', event);
    });
  }

  /**
   * Emit event to internal subscribers
   */
  private emit(event: string, data: unknown): void {
    const subscribers = this.eventSubscriptions.get(event);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          this.error(`Error in event handler for ${event}`, error);
        }
      });
    }
  }

  /**
   * Subscribe to internal events
   */
  on(event: string, callback: Function): () => void {
    if (!this.eventSubscriptions.has(event)) {
      this.eventSubscriptions.set(event, new Set());
    }
    this.eventSubscriptions.get(event)!.add(callback);

    return () => {
      this.eventSubscriptions.get(event)?.delete(callback);
    };
  }

  /**
   * Logging utilities
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[ElectronBrowserHost]', ...args);
    }
  }

  private warn(...args: unknown[]): void {
    console.warn('[ElectronBrowserHost]', ...args);
  }

  private error(...args: unknown[]): void {
    console.error('[ElectronBrowserHost]', ...args);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let hostInstance: ElectronBrowserHost | null = null;

export function getElectronBrowserHost(): ElectronBrowserHost {
  if (!hostInstance) {
    hostInstance = new ElectronBrowserHost();
  }
  return hostInstance;
}

export const electronBrowserHost = getElectronBrowserHost();
