/**
 * Browser Agent Connection
 *
 * Facade exported to the merged extension background script.
 *
 * Usage in background.ts:
 *   import { browserAgentConnection } from '@/browser-agent/connection'
 *   browserAgentConnection.initialize()
 *   browserAgentConnection.handleContentMessage(message, sender, sendResponse)
 *
 * Modes (stored in chrome.storage.local key 'a2rConnection'):
 *   local   — WS ws://localhost:3000/ws/extension (A2R Desktop thin-client)
 *   cowork  — Native messaging com.a2r.native_host (Desktop controls extension)
 *   cloud   — WS wss://api.a2r.io/v1/extension (not used in current thin-client mode)
 */

import { WebSocketClient, WebSocketMessage } from './websocket-client';
import {
  connectNativeHost,
  disconnectNativeHost,
  subscribeToEvents,
  NativeMessage,
} from './native-messaging';
import { executeBrowserAction, setResultSender } from './executor';
import { HostAllowlist } from './safety/host-allowlist';

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionMode = 'local' | 'cowork' | 'cloud';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface StoredConfig {
  mode: ConnectionMode;
  localUrl: string;
  cloudUrl: string;
  authToken?: string;
}

const DEFAULT_CONFIG: StoredConfig = {
  mode: 'local',
  localUrl: 'ws://localhost:3000/ws/extension',
  cloudUrl: 'wss://api.a2r.io/v1/extension',
};

// ─── BrowserAgentConnection class ────────────────────────────────────────────

class BrowserAgentConnection {
  private wsClient: WebSocketClient | null = null;
  private nativeUnsub: (() => void) | null = null;
  private mode: ConnectionMode = 'local';
  private state: ConnectionState = 'disconnected';
  private config: StoredConfig = { ...DEFAULT_CONFIG };
  private readonly allowlist = new HostAllowlist();

  // ── Public API ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    console.log('[BrowserAgentConnection] Initializing');

    await this.allowlist.load();

    const stored = await chrome.storage.local.get(['a2rConnection']);
    if (stored.a2rConnection) {
      this.config = { ...DEFAULT_CONFIG, ...stored.a2rConnection };
    }

    // Wire result sender so executor can relay results back over the connection
    setResultSender((action, tabId, result) => {
      this._sendToBackend({
        id: this._id(),
        type: 'action:complete',
        payload: { action, tabId, result },
        timestamp: Date.now(),
      });
    });

    await this._connect(this.config.mode);
  }

  /**
   * Handle messages from content scripts (BROWSER_ACTION, CONTENT_READY).
   * Returns true to keep the message channel open for async sendResponse.
   */
  handleContentMessage(
    message: { type: string; [k: string]: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void
  ): true | undefined {
    if (message.type === 'CONTENT_READY') {
      console.log('[BrowserAgentConnection] Content script ready on', _sender.tab?.url);
      sendResponse({ ok: true, mode: this.mode, state: this.state });
      return undefined;
    }

    if (message.type === 'BROWSER_ACTION') {
      // Content script completed an action — relay result upstream
      this._sendToBackend({
        id: this._id(),
        type: 'content:action',
        payload: message,
        timestamp: Date.now(),
      });
      sendResponse({ ok: true });
      return undefined;
    }

    return undefined;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _connect(mode: ConnectionMode): Promise<void> {
    await this._disconnect();
    this.mode = mode;

    console.log(`[BrowserAgentConnection] Connecting — mode=${mode}`);

    if (mode === 'local' || mode === 'cloud') {
      const url = mode === 'local' ? this.config.localUrl : this.config.cloudUrl;
      this.wsClient = new WebSocketClient({ url });

      this.wsClient.onStateChange((s) => {
        this.state = s as ConnectionState;
        this._updateBadge();
      });

      this.wsClient.onMessage((msg) => this._onBackendMessage(msg));

      this.wsClient.connect();
    } else if (mode === 'cowork') {
      const ok = await connectNativeHost();
      if (ok) {
        this.state = 'connected';
        this._updateBadge();
        this.nativeUnsub = subscribeToEvents((event: NativeMessage) => {
          this._onBackendMessage(event as unknown as WebSocketMessage);
          if (event.type === 'execute' && event.payload) {
            this._handleCoworkExecute(event.payload).catch((err) =>
              console.error('[BrowserAgentConnection] cowork execute error:', err)
            );
          }
        });
      } else {
        this.state = 'error';
        this._updateBadge();
      }
    }
  }

  private async _disconnect(): Promise<void> {
    this.state = 'disconnected';

    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }

    if (this.nativeUnsub) {
      this.nativeUnsub();
      this.nativeUnsub = null;
    }
    disconnectNativeHost();
    this._updateBadge();
  }

  private _onBackendMessage(msg: WebSocketMessage): void {
    const m = msg as unknown as { type: string; payload?: unknown };

    switch (m.type) {
      case 'execute':
        if (m.payload) {
          this._handleCoworkExecute(m.payload).catch((err) =>
            console.error('[BrowserAgentConnection] execute error:', err)
          );
        }
        break;

      case 'ping':
        this._sendToBackend({
          id: this._id(),
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'getTabs':
        chrome.tabs.query({}).then((tabs) => {
          this._sendToBackend({
            id: this._id(),
            type: 'tabs',
            payload: tabs.map((t) => ({
              id: t.id,
              url: t.url,
              title: t.title,
              active: t.active,
            })),
            timestamp: Date.now(),
          });
        });
        break;

      default:
        console.log('[BrowserAgentConnection] Unknown backend message:', m.type);
    }
  }

  private async _handleCoworkExecute(payload: unknown): Promise<void> {
    const req = payload as { actions?: unknown[] };
    const actions = req.actions ?? [payload];
    for (const action of actions) {
      await executeBrowserAction(action as Parameters<typeof executeBrowserAction>[0]);
    }
  }

  private _sendToBackend(msg: object): void {
    if (this.mode === 'local' || this.mode === 'cloud') {
      this.wsClient?.send(msg as Omit<WebSocketMessage, 'timestamp'>);
    }
    // In cowork mode the Desktop receives results via native messaging response channel
  }

  private async _updateBadge(): Promise<void> {
    const colors: Record<ConnectionState, string> = {
      disconnected: '#9ca3af',
      connecting: '#f59e0b',
      connected: '#22c55e',
      error: '#ef4444',
    };
    const texts: Record<ConnectionState, string> = {
      disconnected: '',
      connecting: '…',
      connected: '●',
      error: '!',
    };
    await chrome.action.setBadgeBackgroundColor({ color: colors[this.state] });
    await chrome.action.setBadgeText({ text: texts[this.state] });
  }

  private _id(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const browserAgentConnection = new BrowserAgentConnection();
