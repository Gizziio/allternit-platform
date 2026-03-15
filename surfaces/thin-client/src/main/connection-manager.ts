/**
 * Connection Manager
 * 
 * Manages WebSocket connection to either:
 * - Cloud VPS (user's backend on a2r.io)
 * - Local A2R Desktop
 */

import WebSocket from 'ws';
import Store from 'electron-store';
import { createLogger } from './logger';

const logger = createLogger('connection');

interface ConnectionStatus {
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  backend: 'cloud' | 'desktop';
  url: string;
  error?: string;
}

interface StoreSchema {
  backend: 'cloud' | 'desktop';
  cloudUrl: string;
  desktopPort: number;
  windowPosition: { x: number; y: number };
}

export class ConnectionManager {
  private ws: WebSocket | null = null;
  private store: Store<StoreSchema>;
  private statusCallback: (status: ConnectionStatus) => void;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private currentStatus: ConnectionStatus = {
    state: 'disconnected',
    backend: 'cloud',
    url: '',
  };

  constructor(
    store: Store<StoreSchema>,
    statusCallback: (status: ConnectionStatus) => void
  ) {
    this.store = store;
    this.statusCallback = statusCallback;
  }

  /**
   * Connect to backend
   */
  async connect(): Promise<void> {
    const backend = this.store.get('backend');
    
    if (backend === 'cloud') {
      await this.connectToCloud();
    } else {
      await this.connectToDesktop();
    }
  }

  /**
   * Connect to cloud backend
   */
  private async connectToCloud(): Promise<void> {
    const cloudUrl = this.store.get('cloudUrl');
    logger.info(`Connecting to cloud: ${cloudUrl}`);

    this.updateStatus({
      state: 'connecting',
      backend: 'cloud',
      url: cloudUrl,
    });

    try {
      this.ws = new WebSocket(cloudUrl, {
        headers: {
          'X-Client-Type': 'thin-client',
          'X-Client-Version': '0.1.0',
        },
      });

      this.setupWebSocketHandlers();
    } catch (error) {
      logger.error('Failed to connect to cloud:', error);
      this.updateStatus({
        state: 'error',
        backend: 'cloud',
        url: cloudUrl,
        error: String(error),
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Connect to local desktop
   */
  private async connectToDesktop(): Promise<void> {
    const port = this.store.get('desktopPort');
    const desktopUrl = `ws://localhost:${port}/ws/thin-client`;
    
    logger.info(`Connecting to desktop: ${desktopUrl}`);

    this.updateStatus({
      state: 'connecting',
      backend: 'desktop',
      url: desktopUrl,
    });

    try {
      this.ws = new WebSocket(desktopUrl, {
        headers: {
          'X-Client-Type': 'thin-client',
        },
      });

      this.setupWebSocketHandlers();
    } catch (error) {
      logger.error('Failed to connect to desktop:', error);
      this.updateStatus({
        state: 'error',
        backend: 'desktop',
        url: desktopUrl,
        error: String(error),
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      logger.info('WebSocket connected');
      this.reconnectAttempts = 0; // Reset counter on successful connection
      this.updateStatus({
        state: 'connected',
        backend: this.currentStatus.backend,
        url: this.currentStatus.url,
      });

      // Start ping interval
      this.startPingInterval();

      // Send init message
      this.send({
        type: 'init',
        payload: {
          clientType: 'thin-client',
          capabilities: ['chat', 'app-connection', 'desktop-integration'],
        },
      });
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse message:', error);
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.info(`WebSocket closed: ${code} - ${reason}`);
      this.cleanup();
      this.updateStatus({
        state: 'disconnected',
        backend: this.currentStatus.backend,
        url: this.currentStatus.url,
      });
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      this.updateStatus({
        state: 'error',
        backend: this.currentStatus.backend,
        url: this.currentStatus.url,
        error: error.message,
      });
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any): void {
    logger.debug('Received message:', message.type);

    // Broadcast to renderer
    // This will be implemented via IPC
  }

  /**
   * Send message to backend
   */
  send(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Send message and wait for response
   */
  async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const messageId = generateId();
      const fullMessage = { ...message, id: messageId };

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000);

      const handler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.inResponseTo === messageId) {
            clearTimeout(timeout);
            this.ws?.off('message', handler);
            resolve(response);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(fullMessage));
    });
  }

  /**
   * Reconnect with different backend
   */
  async reconnect(backend: 'cloud' | 'desktop'): Promise<void> {
    this.store.set('backend', backend);
    this.disconnect();
    await this.connect();
  }

  /**
   * Disconnect from backend
   */
  disconnect(): void {
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.updateStatus({
      state: 'disconnected',
      backend: this.currentStatus.backend,
      url: this.currentStatus.url,
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectInterval) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.info(`Max reconnect attempts (${this.maxReconnectAttempts}) reached, giving up`);
      this.updateStatus({
        state: 'error',
        backend: this.currentStatus.backend,
        url: this.currentStatus.url,
        error: 'Connection failed after multiple attempts. Check settings or backend availability.',
      });
      return;
    }

    // Exponential backoff: baseDelay * 2^attempts, capped at maxDelay
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.updateStatus({
      ...this.currentStatus,
      state: 'connecting',
      error: `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
    });
    
    this.reconnectInterval = setTimeout(() => {
      this.reconnectInterval = null;
      this.connect();
    }, delay);
  }

  private lastPongReceived = Date.now();
  private readonly PING_INTERVAL = 30000;
  private readonly PING_TIMEOUT = 10000;

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.lastPongReceived = Date.now();
    
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Check if we received a pong recently
        const timeSinceLastPong = Date.now() - this.lastPongReceived;
        if (timeSinceLastPong > this.PING_INTERVAL + this.PING_TIMEOUT) {
          logger.warn('No pong received, connection may be stale');
          this.ws.terminate(); // Force close
          this.cleanup();
          this.scheduleReconnect();
          return;
        }
        
        this.ws.ping();
      }
    }, this.PING_INTERVAL);

    // Listen for pong responses
    this.ws?.on('pong', () => {
      this.lastPongReceived = Date.now();
    });
  }

  /**
   * Update connection status
   */
  private updateStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.statusCallback(status);
  }

  /**
   * Get current status
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
