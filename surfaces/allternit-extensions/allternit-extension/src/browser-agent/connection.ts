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
 * Mode:
 *   cowork  — Native messaging com.allternit.desktop (Desktop app controls extension via TCP 3011)
 */

import { WebSocketMessage } from './websocket-client';
import {
  connectNativeHost,
  disconnectNativeHost,
  isNativeHostConnected,
  pingNativeHost,
  subscribeToEvents,
  NativeMessage,
} from './native-messaging';
import { executeBrowserAction, setResultSender } from './executor';
import { HostAllowlist } from './safety/host-allowlist';
import {
  parseExtensionActionCommand,
  toLegacyBrowserAction,
  toProtocolActionFailure,
  toProtocolActionResult,
} from './protocol-transport';

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionMode = 'cowork';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── BrowserAgentConnection class ────────────────────────────────────────────

class BrowserAgentConnection {
  private nativeUnsub: (() => void) | null = null;
  private mode: ConnectionMode = 'cowork';
  private state: ConnectionState = 'disconnected';
  private readonly allowlist = new HostAllowlist();

  // ── Public API ──────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    console.log('[BrowserAgentConnection] Initializing');

    await this.allowlist.load();

    // Wire result sender so executor can relay results back over the connection
    setResultSender((action, tabId, result) => {
      this._sendToBackend({
        id: this._id(),
        type: 'action:complete',
        payload: { action, tabId, result },
        timestamp: Date.now(),
      });
    });

    await this._connect();
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

  async checkNativeHostStatus(): Promise<{
    host: string;
    connected: boolean;
    ping: boolean;
    mode: ConnectionMode;
    state: ConnectionState;
  }> {
    const connected = isNativeHostConnected() || await connectNativeHost();
    const ping = connected ? await pingNativeHost() : false;
    return {
      host: 'com.allternit.desktop',
      connected,
      ping,
      mode: this.mode,
      state: this.state,
    };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    await this._disconnect();
    this.mode = 'cowork';

    console.log('[BrowserAgentConnection] Connecting — mode=cowork');

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

  private async _disconnect(): Promise<void> {
    this.state = 'disconnected';

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
      case 'computer_use.action': {
        void this._handleProtocolAction(m.payload).catch((err) =>
          console.error('[BrowserAgentConnection] protocol action error:', err)
        );
        break;
      }
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

  private async _handleProtocolAction(payload: unknown): Promise<void> {
    const command = parseExtensionActionCommand(payload);
    const legacyAction = toLegacyBrowserAction(command);
    try {
      const result = await executeBrowserAction(legacyAction as Parameters<typeof executeBrowserAction>[0]);
      this._sendToBackend({
        id: this._id(),
        type: 'computer_use.events',
        payload: toProtocolActionResult(command, result),
        timestamp: Date.now(),
      });
    } catch (error) {
      this._sendToBackend({
        id: this._id(),
        type: 'computer_use.events',
        payload: toProtocolActionFailure(command, error),
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  private _sendToBackend(_msg: object): void {
    // Results reach the Desktop via the native messaging response channel;
    // there is nothing to send on this path.
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
