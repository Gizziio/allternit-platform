/**
 * Cloud Connector
 * 
 * Handles WebSocket connection to cloud VPS (allternit.com).
 * This enables the extension to work without the local Desktop app.
 */

import { z } from 'zod';

// Cloud message schemas
const CloudMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.unknown().optional(),
  timestamp: z.number(),
});

const AuthRequestSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
  clientType: z.literal('browser-extension'),
  version: z.string(),
});

const AuthResponseSchema = z.object({
  type: z.literal('auth:response'),
  success: z.boolean(),
  error: z.string().optional(),
  sessionId: z.string().optional(),
});

export type CloudMessage = z.infer<typeof CloudMessageSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export type ConnectionMode = 'cloud' | 'local' | 'cowork';
export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface CloudConfig {
  url: string;
  authToken?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface CloudConnectorCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onMessage: (message: CloudMessage) => void;
  onError: (error: Error) => void;
}

/**
 * Cloud Connector - Manages connection to cloud VPS
 */
export class CloudConnector {
  private ws: WebSocket | null = null;
  private config: Required<CloudConfig>;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private messageQueue: CloudMessage[] = [];
  private callbacks: CloudConnectorCallbacks;
  private sessionId: string | null = null;

  constructor(config: CloudConfig, callbacks: CloudConnectorCallbacks) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 5,
      ...config,
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to cloud backend
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      console.log('[Cloud] Connecting to:', this.config.url);
      
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('[Cloud] WebSocket opened, authenticating...');
        this.setState('authenticating');
        this.authenticate();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[Cloud] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[Cloud] WebSocket closed');
        this.setState('disconnected');
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[Cloud] WebSocket error:', error);
        this.setState('error');
        this.callbacks.onError(new Error('WebSocket connection failed'));
      };
    } catch (error) {
      console.error('[Cloud] Failed to create connection:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from cloud backend
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

    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.setState('disconnected');
  }

  /**
   * Send message to cloud backend
   */
  send(message: Omit<CloudMessage, 'timestamp'>): void {
    const fullMessage: CloudMessage = {
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
   * Send request and wait for response
   */
  async request<T>(
    message: Omit<CloudMessage, 'timestamp' | 'id'>,
    timeoutMs = 30000
  ): Promise<T> {
    const id = this.generateId();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeoutMs);

      const handler = (response: CloudMessage) => {
        if (response.id === id) {
          clearTimeout(timeout);
          this.off('message', handler);
          resolve(response.payload as T);
        }
      };

      this.on('message', handler);
      this.send({ ...message, id });
    });
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
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  private authenticate(): void {
    const authMessage: AuthRequest = {
      type: 'auth',
      token: this.config.authToken || '',
      clientType: 'browser-extension',
      version: chrome.runtime.getManifest().version,
    };

    this.ws?.send(JSON.stringify({
      id: this.generateId(),
      ...authMessage,
      timestamp: Date.now(),
    }));
  }

  private handleMessage(data: unknown): void {
    try {
      const message = CloudMessageSchema.parse(data);

      // Handle authentication response
      if (message.type === 'auth:response') {
        const response = AuthResponseSchema.parse(message.payload);
        if (response.success) {
          this.sessionId = response.sessionId || null;
          this.reconnectAttempts = 0;
          this.setState('connected');
          this.startHeartbeat();
          this.flushMessageQueue();
          console.log('[Cloud] Authenticated, session:', this.sessionId);
        } else {
          console.error('[Cloud] Authentication failed:', response.error);
          this.setState('error');
          this.disconnect();
        }
        return;
      }

      // Forward to callback
      this.callbacks.onMessage(message);
    } catch (error) {
      console.error('[Cloud] Invalid message format:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log('[Cloud] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    
    console.log(`[Cloud] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
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
    this.heartbeatTimer = window.setInterval(() => {
      this.send({
        id: this.generateId(),
        type: 'ping',
      });
    }, 30000);
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

  // Simple event emitter pattern for internal use
  private messageHandlers: Set<(msg: CloudMessage) => void> = new Set();
  
  private on(event: 'message', handler: (msg: CloudMessage) => void): void {
    this.messageHandlers.add(handler);
  }
  
  private off(event: 'message', handler: (msg: CloudMessage) => void): void {
    this.messageHandlers.delete(handler);
  }
}

// Global instance
let cloudConnector: CloudConnector | null = null;

export function initCloudConnector(config: CloudConfig, callbacks: CloudConnectorCallbacks): CloudConnector {
  cloudConnector = new CloudConnector(config, callbacks);
  return cloudConnector;
}

export function getCloudConnector(): CloudConnector | null {
  return cloudConnector;
}

export function disconnectCloud(): void {
  cloudConnector?.disconnect();
  cloudConnector = null;
}
