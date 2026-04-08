/**
 * Connection Manager
 * 
 * Manages switching between three connection modes:
 * - Cloud: Connect to cloud VPS (a2r.io)
 * - Local: Connect to local A2R Desktop via WebSocket
 * - Cowork: Desktop controls extension via Native Messaging
 */

import { CloudConnector, ConnectionMode, ConnectionState, CloudMessage } from './cloud-connector';
import { 
  connectNativeHost, 
  disconnectNativeHost, 
  isNativeHostConnected,
  subscribeToEvents,
  ExecuteRequest 
} from './native-messaging';
import { WebSocketClient } from './websocket-client';

// Connection configuration
interface ConnectionConfig {
  mode: ConnectionMode;
  cloudUrl: string;
  localUrl: string;
  authToken?: string;
}

// Default configuration
const DEFAULT_CONFIG: ConnectionConfig = {
  mode: 'cloud',
  cloudUrl: 'wss://api.a2r.io/v1/extension',
  localUrl: 'ws://localhost:3000/ws/extension',
};

/**
 * Connection Manager
 */
export class ConnectionManager {
  private config: ConnectionConfig;
  private cloudConnector: CloudConnector | null = null;
  private localWsClient: WebSocketClient | null = null;
  private mode: ConnectionMode = 'cloud';
  private state: ConnectionState = 'disconnected';
  private messageHandlers: Set<(message: unknown) => void> = new Set();
  private nativeMessageUnsubscribe: (() => void) | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize from stored configuration
   */
  async initialize(): Promise<void> {
    const stored = await chrome.storage.local.get(['a2rConnection']);
    if (stored.a2rConnection) {
      this.config = { ...DEFAULT_CONFIG, ...stored.a2rConnection };
    }
    
    // Auto-connect on initialize
    await this.connect(this.config.mode);
  }

  /**
   * Connect using specified mode
   */
  async connect(mode: ConnectionMode): Promise<boolean> {
    // Disconnect current connection
    await this.disconnect();
    
    this.mode = mode;
    this.config.mode = mode;
    
    // Save preference
    await chrome.storage.local.set({ 
      a2rConnection: { ...this.config, mode } 
    });

    console.log(`[ConnectionManager] Connecting in ${mode} mode`);

    switch (mode) {
      case 'cloud':
        return this.connectCloud();
      case 'local':
        return this.connectLocal();
      case 'cowork':
        return this.connectCowork();
      default:
        return false;
    }
  }

  /**
   * Disconnect from all backends
   */
  async disconnect(): Promise<void> {
    this.setState('disconnected');

    // Disconnect cloud
    if (this.cloudConnector) {
      this.cloudConnector.disconnect();
      this.cloudConnector = null;
    }

    // Disconnect local WebSocket
    if (this.localWsClient) {
      this.localWsClient.disconnect();
      this.localWsClient = null;
    }

    // Disconnect native messaging
    if (this.nativeMessageUnsubscribe) {
      this.nativeMessageUnsubscribe();
      this.nativeMessageUnsubscribe = null;
    }
    disconnectNativeHost();

    // Update badge
    await this.updateBadge();
  }

  /**
   * Send message to current backend
   */
  send(message: unknown): void {
    const msg = message as { type: string; [key: string]: unknown };
    
    switch (this.mode) {
      case 'cloud':
        this.cloudConnector?.send(msg as CloudMessage);
        break;
      case 'local':
        this.localWsClient?.send(msg as any);
        break;
      case 'cowork':
        // In cowork mode, Desktop initiates commands via native messaging
        // Extension responses go back through native messaging automatically
        console.log('[ConnectionManager] Cowork mode - Desktop initiates commands');
        break;
    }
  }

  /**
   * Get current connection mode
   */
  getMode(): ConnectionMode {
    return this.mode;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get configuration
   */
  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<ConnectionConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await chrome.storage.local.set({ a2rConnection: this.config });
  }

  /**
   * Subscribe to messages from backend
   */
  onMessage(handler: (message: unknown) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // ============================================================================
  // Private Connection Methods
  // ============================================================================

  private async connectCloud(): Promise<boolean> {
    try {
      this.cloudConnector = new CloudConnector(
        {
          url: this.config.cloudUrl,
          authToken: this.config.authToken,
        },
        {
          onStateChange: (state) => {
            this.setState(state);
            this.updateBadge();
          },
          onMessage: (message) => {
            this.broadcastMessage(message);
          },
          onError: (error) => {
            console.error('[ConnectionManager] Cloud error:', error);
          },
        }
      );

      this.cloudConnector.connect();
      return true;
    } catch (error) {
      console.error('[ConnectionManager] Cloud connection failed:', error);
      return false;
    }
  }

  private async connectLocal(): Promise<boolean> {
    try {
      this.localWsClient = new WebSocketClient({ url: this.config.localUrl });
      
      this.localWsClient.onStateChange((state) => {
        this.setState(state as ConnectionState);
        this.updateBadge();
      });

      this.localWsClient.onMessage((message) => {
        this.broadcastMessage(message);
      });

      this.localWsClient.connect();
      return true;
    } catch (error) {
      console.error('[ConnectionManager] Local connection failed:', error);
      return false;
    }
  }

  private async connectCowork(): Promise<boolean> {
    try {
      // In cowork mode, the Desktop app controls the extension via native messaging
      const connected = await connectNativeHost();
      
      if (connected) {
        this.setState('connected');
        this.updateBadge();

        // Subscribe to events from Desktop
        this.nativeMessageUnsubscribe = subscribeToEvents((event) => {
          console.log('[ConnectionManager] Cowork event from Desktop:', event);
          this.broadcastMessage(event);
          
          // Handle execute commands from Desktop
          if (event.type === 'execute' && event.payload) {
            this.handleCoworkExecute(event.payload as ExecuteRequest);
          }
        });

        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ConnectionManager] Cowork connection failed:', error);
      return false;
    }
  }

  private async handleCoworkExecute(request: ExecuteRequest): Promise<void> {
    // Import dynamically to avoid circular dependencies
    const { executeBrowserAction } = await import('./service-worker');
    
    try {
      // Execute browser actions as requested by Desktop
      for (const action of request.actions) {
        await executeBrowserAction(action);
      }
    } catch (error) {
      console.error('[ConnectionManager] Cowork execute failed:', error);
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      console.log(`[ConnectionManager] State: ${state}`);
    }
  }

  private broadcastMessage(message: unknown): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[ConnectionManager] Message handler error:', error);
      }
    });
  }

  private async updateBadge(): Promise<void> {
    const colors = {
      disconnected: '#9ca3af', // gray
      connecting: '#f59e0b',   // amber
      authenticating: '#3b82f6', // blue
      connected: '#22c55e',    // green
      error: '#ef4444',        // red
    };

    const texts = {
      disconnected: '',
      connecting: '...',
      authenticating: '...',
      connected: '●',
      error: '!',
    };

    await chrome.action.setBadgeBackgroundColor({ 
      color: colors[this.state] 
    });
    await chrome.action.setBadgeText({ 
      text: texts[this.state] 
    });
  }
}

// Global instance
let connectionManager: ConnectionManager | null = null;

export function getConnectionManager(): ConnectionManager {
  if (!connectionManager) {
    connectionManager = new ConnectionManager();
  }
  return connectionManager;
}

export async function initConnectionManager(): Promise<ConnectionManager> {
  const manager = getConnectionManager();
  await manager.initialize();
  return manager;
}
