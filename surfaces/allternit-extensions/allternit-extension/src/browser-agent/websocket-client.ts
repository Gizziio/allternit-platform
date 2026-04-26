/**
 * WebSocket Client
 * 
 * Manages WebSocket connection to Allternit API from service worker.
 * Handles reconnection, message queuing, and heartbeat.
 */

import type { NativeMessage } from './native-messaging';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectDecay?: number;
  timeoutInterval?: number;
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private state: ConnectionState = 'disconnected';
  private stateHandlers: Set<(state: ConnectionState) => void> = new Set();
  private messageHandlers: Set<(message: WebSocketMessage) => void> = new Set();
  private pendingRequests: Map<string, (response: WebSocketMessage) => void> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      reconnectDecay: 1.5,
      timeoutInterval: 5000,
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        this.setState('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.setState('error');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Send a message
   */
  send(message: Omit<WebSocketMessage, 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now(),
    };

    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      this.messageQueue.push(fullMessage);
    }
  }

  /**
   * Send a message and wait for response
   */
  async request(
    message: Omit<WebSocketMessage, 'timestamp' | 'id'>,
    timeoutMs = 30000
  ): Promise<WebSocketMessage> {
    const id = this.generateId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.send({ ...message, id });
    });
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /**
   * Subscribe to messages
   */
  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
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

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateHandlers.forEach((handler) => {
        try {
          handler(newState);
        } catch (error) {
          console.error('[WebSocket] State handler error:', error);
        }
      });
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle pending request responses
    if (message.id && this.pendingRequests.has(message.id)) {
      const handler = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      handler(message);
      return;
    }

    // Broadcast to message handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('[WebSocket] Message handler error:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({
        id: this.generateId(),
        type: 'ping',
      });
    }, this.config.timeoutInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global WebSocket client instance
let globalClient: WebSocketClient | null = null;

export function getWebSocketClient(url?: string): WebSocketClient {
  if (!globalClient && url) {
    globalClient = new WebSocketClient({ url });
  }
  return globalClient!;
}

export function initWebSocket(url: string): WebSocketClient {
  globalClient = new WebSocketClient({ url });
  globalClient.connect();
  return globalClient;
}
