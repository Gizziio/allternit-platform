/**
 * WebSocket Client for Real-Time Updates
 * 
 * Provides live updates from the API server:
 * - Task updates
 * - Memory appends
 * - Policy changes
 * - Connection status
 * 
 * Pattern ported from agent-shell integration guide.
 */

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface TaskUpdateMessage extends WebSocketMessage {
  type: 'task_update';
  payload: {
    taskId: string;
    changes: Partial<{
      title: string;
      status: string;
      priority: string;
    }>;
  };
}

export interface MemoryAppendMessage extends WebSocketMessage {
  type: 'memory_append';
  payload: {
    entryId: string;
    content: string;
    type: string;
  };
}

export interface PolicyChangeMessage extends WebSocketMessage {
  type: 'policy_change';
  payload: {
    ruleId: string;
    action: 'added' | 'updated' | 'removed';
  };
}

export interface ConnectionStatusMessage extends WebSocketMessage {
  type: 'connection_status';
  payload: {
    status: 'connected' | 'disconnected';
    clientCount?: number;
  };
}

export type MessageHandler = (message: WebSocketMessage) => void;
export type StatusHandler = (status: WebSocketStatus) => void;

export interface WorkspaceWebSocketOptions {
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectInterval?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
}

/**
 * WebSocket client for real-time workspace updates
 * 
 * @example
 * ```typescript
 * const ws = new WorkspaceWebSocket('ws://localhost:3010/ws', 'password');
 * 
 * ws.onMessage((msg) => {
 *   if (msg.type === 'task_update') {
 *     updateTaskInUI(msg.payload);
 *   }
 * });
 * 
 * ws.connect();
 * ```
 */
export class WorkspaceWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private authToken: string;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  
  private options: Required<WorkspaceWebSocketOptions>;

  constructor(
    url: string, 
    password: string,
    options: WorkspaceWebSocketOptions = {}
  ) {
    this.url = url;
    // Create auth token (Basic auth format)
    this.authToken = btoa(`allternit:${password}`);
    
    this.options = {
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      connectTimeout: 10000,
      heartbeatInterval: 30000,
      ...options,
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setStatus('connecting');
      console.log('[WebSocket] Connecting to:', this.url);

      try {
        this.ws = new WebSocket(this.url);

        // Connection timeout
        const timeout = setTimeout(() => {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }, this.options.connectTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.setStatus('connected');
          
          // Send authentication
          this.send({
            type: 'auth',
            token: this.authToken,
          });

          // Start heartbeat
          this.startHeartbeat();

          console.log('[WebSocket] Connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          this.setStatus('disconnected');
          this.stopHeartbeat();
          
          console.log('[WebSocket] Disconnected');
          
          if (this.options.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          this.setStatus('error');
          console.error('[WebSocket] Error:', error);
          reject(error);
        };
      } catch (error) {
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.options.autoReconnect = false; // Prevent auto-reconnect on manual disconnect
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  /**
   * Send a message to the server
   */
  send(message: unknown): void {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot send, not connected');
      return;
    }
    
    this.ws?.send(JSON.stringify(message));
  }

  /**
   * Subscribe to messages
   * @returns Unsubscribe function
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to connection status changes
   * @returns Unsubscribe function
   */
  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Subscribe to specific message type
   * @returns Unsubscribe function
   */
  on<T extends WebSocketMessage>(
    type: T['type'], 
    handler: (payload: T['payload']) => void
  ): () => void {
    const wrappedHandler: MessageHandler = (message) => {
      if (message.type === type) {
        handler(message.payload as T['payload']);
      }
    };
    
    return this.onMessage(wrappedHandler);
  }

  /**
   * Request a specific resource update
   */
  requestUpdate(resource: string, id?: string): void {
    this.send({
      type: 'request_update',
      resource,
      id,
    });
  }

  /**
   * Subscribe to a resource for live updates
   */
  subscribe(resource: string, id?: string): void {
    this.send({
      type: 'subscribe',
      resource,
      id,
    });
  }

  /**
   * Unsubscribe from a resource
   */
  unsubscribe(resource: string, id?: string): void {
    this.send({
      type: 'unsubscribe',
      resource,
      id,
    });
  }

  private setStatus(status: WebSocketStatus): void {
    this.status = status;
    this.statusHandlers.forEach(handler => handler(status));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WebSocketMessage;
      
      // Add timestamp if not present
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }

      console.log('[WebSocket] Received:', message.type);
      
      this.messageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[WebSocket] Handler error:', error);
        }
      });
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WebSocket] Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnect failed, will try again if autoReconnect is enabled
      });
    }, this.options.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: new Date().toISOString() });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/**
 * Create a WebSocket URL from an HTTP URL
 */
export function createWebSocketUrl(httpUrl: string, path: string = '/ws'): string {
  const url = new URL(httpUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}${path}`;
}

export default WorkspaceWebSocket;
