/**
 * Browser Engine Service
 * 
 * Ported from: 6-ui/shell-ui/src/views/browserview/src/lib.rs
 * 
 * Provides browser automation capabilities for the Shell UI.
 * Uses backend API for Playwright integration (native binary required).
 */

import {
  BrowserViewConfig,
  BrowserState,
  BrowserAction,
  BrowserActionResult,
  CaptureResult,
  CaptureSize,
  HistoryEntry,
  RendererType,
  SessionConfig,
  SessionMetadata,
  defaultBrowserConfig,
} from '@/types/browser';

/** Browser engine options */
export interface BrowserEngineOptions {
  apiBaseUrl: string;
  onStateChange?: (state: BrowserState) => void;
  onCapture?: (capture: CaptureResult) => void;
}

/**
 * Browser Engine
 * 
 * Manages browser automation sessions using Playwright via backend API.
 */
export class BrowserEngine {
  private sessionId: string | null = null;
  private config: BrowserViewConfig;
  private options: BrowserEngineOptions;
  private state: BrowserState;
  private eventSource: EventSource | null = null;

  constructor(options: BrowserEngineOptions) {
    this.options = options;
    this.config = { ...defaultBrowserConfig };
    this.state = this.createInitialState();
  }

  private createInitialState(): BrowserState {
    return {
      current_url: '',
      title: '',
      loading: false,
      history: [],
      history_index: 0,
      session_id: '',
      agent_mode_active: false,
    };
  }

  /** Create a new browser runtime session */
  async createRuntimeSession(config?: Partial<BrowserViewConfig>): Promise<string> {
    this.config = { ...this.config, ...config };
    
    const response = await fetch(`${this.options.apiBaseUrl}/browser/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.config),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const metadata: SessionMetadata = await response.json();
    this.sessionId = metadata.session_id;
    this.state.session_id = metadata.session_id;
    
    // Connect to event stream for real-time updates
    this.connectEventStream();
    
    return this.sessionId;
  }

  /** Connect to server-sent events for state updates */
  private connectEventStream(): void {
    if (!this.sessionId) return;
    
    this.eventSource = new EventSource(
      `${this.options.apiBaseUrl}/browser/${this.sessionId}/events`
    );
    
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'state_update') {
        this.state = { ...this.state, ...data.state };
        this.options.onStateChange?.(this.state);
      }
    };
  }

  /** Close the browser session */
  async closeSession(): Promise<void> {
    if (!this.sessionId) return;
    
    this.eventSource?.close();
    
    await fetch(`${this.options.apiBaseUrl}/browser/${this.sessionId}`, {
      method: 'DELETE',
    });
    
    this.sessionId = null;
  }

  /** Navigate to a URL */
  async navigate(url: string, renderer: RendererType = RendererType.Agent): Promise<void> {
    await this.executeAction({ action: 'navigate', url, renderer });
  }

  /** Go back in history */
  async back(): Promise<void> {
    await this.executeAction({ action: 'back' });
  }

  /** Go forward in history */
  async forward(): Promise<void> {
    await this.executeAction({ action: 'forward' });
  }

  /** Reload the current page */
  async reload(): Promise<void> {
    await this.executeAction({ action: 'reload' });
  }

  /** Stop loading */
  async stop(): Promise<void> {
    await this.executeAction({ action: 'stop' });
  }

  /** Take a screenshot */
  async screenshot(fullPage: boolean = false): Promise<CaptureResult> {
    const result = await this.executeAction({ action: 'screenshot', full_page: fullPage });
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Screenshot failed');
    }
    
    const capture = result.data as CaptureResult;
    this.options.onCapture?.(capture);
    return capture;
  }

  /** Extract data using CSS selector */
  async extract(selector: string): Promise<unknown> {
    const result = await this.executeAction({ action: 'extract', selector });
    
    if (!result.success) {
      throw new Error(result.error || 'Extraction failed');
    }
    
    return result.data;
  }

  /** Click an element */
  async click(selector: string): Promise<void> {
    await this.executeAction({ action: 'click', selector });
  }

  /** Type text into an input */
  async typeText(selector: string, text: string): Promise<void> {
    await this.executeAction({ action: 'type_text', selector, text });
  }

  /** Scroll the page */
  async scroll(x: number, y: number): Promise<void> {
    await this.executeAction({ action: 'scroll', x, y });
  }

  /** Wait for an element to appear */
  async waitFor(selector: string, timeoutMs: number = 30000): Promise<void> {
    await this.executeAction({ action: 'wait_for', selector, timeout_ms: timeoutMs });
  }

  /** Evaluate JavaScript in the page */
  async evaluate(script: string): Promise<unknown> {
    const result = await this.executeAction({ action: 'evaluate', script });
    return result.data;
  }

  /** Execute any browser action */
  private async executeAction(action: BrowserAction): Promise<BrowserActionResult> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${this.options.apiBaseUrl}/browser/${this.sessionId}/action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      }
    );

    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /** Get current state */
  getState(): BrowserState {
    return { ...this.state };
  }

  /** Get browser runtime session ID */
  getRuntimeSessionId(): string | null {
    return this.sessionId;
  }

  /** Check if session is active */
  isActive(): boolean {
    return this.sessionId !== null;
  }

  /** Get navigation history */
  getHistory(): HistoryEntry[] {
    return [...this.state.history];
  }

  /** Enable/disable agent mode */
  async setAgentMode(active: boolean): Promise<void> {
    this.state.agent_mode_active = active;
    // Notify backend of mode change
    await fetch(`${this.options.apiBaseUrl}/browser/${this.sessionId}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_mode: active }),
    });
  }

  /** Create a receipt for the current session */
  async createReceipt(action: string, metadata?: Record<string, unknown>): Promise<string> {
    const response = await fetch(
      `${this.options.apiBaseUrl}/browser/${this.sessionId}/receipt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, metadata }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create receipt');
    }

    const result = await response.json();
    return result.receipt_id;
  }
}

/** Create a browser engine instance */
export function createBrowserEngine(options: BrowserEngineOptions): BrowserEngine {
  return new BrowserEngine(options);
}

/** Hook-compatible factory for React */
export function useBrowserEngine(apiBaseUrl: string) {
  return {
    create: () => createBrowserEngine({ apiBaseUrl }),
  };
}
