/**
 * Cowork Mode Controller
 * 
 * Enables the Desktop app to:
 * 1. Accept WebSocket connections from Thin Client
 * 2. Control the Web Extension via native messaging
 * 3. Route commands between Thin Client and Extension
 * 4. Provide bidirectional communication
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { app } from 'electron';
import { EventEmitter } from 'events';
import * as net from 'net';

// Thin Client protocol
interface ThinClientMessage {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

// Native messaging protocol (Chrome Extension)
interface NativeMessage {
  id: string;
  type: 'ping' | 'pong' | 'execute' | 'result' | 'error' | 'event' | 'register' | 'unregister';
  payload?: unknown;
  timestamp: number;
}

interface ExecuteRequest {
  tabId: number;
  url: string;
  actions: BrowserAction[];
  options?: {
    timeout?: number;
    waitForNavigation?: boolean;
  };
}

interface BrowserAction {
  type: string;
  [key: string]: unknown;
}

// Connection states
type CoworkState = 'idle' | 'thinClientConnected' | 'extensionConnected' | 'fullyConnected' | 'error';

// Extension port interface (simplified for Node.js)
interface ExtensionPort {
  postMessage: (message: NativeMessage) => void;
  disconnect: () => void;
  onMessage?: (callback: (message: NativeMessage) => void) => void;
  onDisconnect?: (callback: () => void) => void;
}

/**
 * CoworkController - Manages Cowork mode connections
 */
export class CoworkController extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private thinClientWs: WebSocket | null = null;
  private extensionPort: ExtensionPort | null = null;
  private nativeSocket: net.Socket | null = null;
  private state: CoworkState = 'idle';
  private port: number = 3010;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private lastThinClientPong: number = 0;
  private lastNativePong: number = 0;
  private readonly PING_INTERVAL = 30000;
  private readonly PING_TIMEOUT = 10000;

  constructor(port: number = 3010) {
    super();
    this.port = port;
  }

  /**
   * Start the Cowork mode controller
   */
  async start(): Promise<void> {
    console.log('[Cowork] Starting controller on port', this.port);
    
    try {
      // Create WebSocket server for Thin Client
      this.wss = new WebSocketServer({ port: this.port });
      
      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        console.log('[Cowork] Thin Client connected from', req.socket.remoteAddress);
        this.handleThinClientConnection(ws);
      });

      this.wss.on('error', (error: Error) => {
        console.error('[Cowork] WebSocket server error:', error);
        this.setState('error');
      });

      // Start native messaging host
      this.startNativeMessagingHost();
      
      // Start heartbeat
      this.startHeartbeat();

      this.setState('idle');
      console.log('[Cowork] Controller started successfully');
      
      this.emit('started', { port: this.port });
    } catch (error) {
      console.error('[Cowork] Failed to start controller:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Stop the controller
   */
  stop(): void {
    console.log('[Cowork] Stopping controller');
    
    // Clear heartbeat
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close Thin Client connection
    if (this.thinClientWs) {
      this.thinClientWs.close();
      this.thinClientWs = null;
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close native socket
    if (this.nativeSocket) {
      this.nativeSocket.end();
      this.nativeSocket = null;
    }

    this.setState('idle');
    this.emit('stopped');
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      // Check Thin Client connection
      if (this.thinClientWs?.readyState === WebSocket.OPEN) {
        const timeSinceLastPong = now - this.lastThinClientPong;
        if (timeSinceLastPong > this.PING_INTERVAL + this.PING_TIMEOUT) {
          console.log('[Cowork] Thin Client connection stale, closing');
          this.thinClientWs.terminate();
          this.thinClientWs = null;
          this.setState(this.nativeSocket ? 'extensionConnected' : 'idle');
        } else {
          this.thinClientWs.ping();
        }
      }
      
      // Check Native connection (via last activity)
      if (this.nativeSocket && !this.nativeSocket.destroyed) {
        // Send ping via native socket
        this.sendNativeMessage({
          id: this.generateId(),
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Get current state
   */
  getState(): CoworkState {
    return this.state;
  }

  /**
   * Check if fully connected (both Thin Client and Extension)
   */
  isFullyConnected(): boolean {
    return this.state === 'fullyConnected';
  }

  /**
   * Send command to browser via extension
   */
  async executeInBrowser(request: ExecuteRequest): Promise<unknown> {
    if (!this.extensionPort) {
      throw new Error('Extension not connected');
    }

    const id = this.generateId();
    const message: NativeMessage = {
      id,
      type: 'execute',
      payload: request,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Extension execution timeout'));
      }, request.options?.timeout || 30000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.extensionPort?.postMessage(message);
    });
  }

  /**
   * Send message to Thin Client
   */
  sendToThinClient(message: ThinClientMessage): void {
    if (this.thinClientWs?.readyState === WebSocket.OPEN) {
      this.thinClientWs.send(JSON.stringify(message));
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startNativeMessagingHost(): void {
    // Native messaging host listens on port 3011
    const NATIVE_PORT = 3011;
    
    const server = net.createServer((socket) => {
      console.log('[Cowork] Native messaging host connected');
      this.nativeSocket = socket;
      this.lastNativePong = Date.now();
      this.setState(this.thinClientWs ? 'fullyConnected' : 'extensionConnected');

      let buffer = Buffer.alloc(0);
      let messageLength = 0;

      socket.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        // Chrome native messaging protocol: 4-byte length prefix
        while (buffer.length >= 4) {
          if (messageLength === 0) {
            messageLength = buffer.readUInt32LE(0);
          }

          if (buffer.length >= 4 + messageLength) {
            const messageBuffer = buffer.subarray(4, 4 + messageLength);
            buffer = buffer.subarray(4 + messageLength);
            messageLength = 0;

            try {
              const message = JSON.parse(messageBuffer.toString()) as NativeMessage;
              this.handleNativeMessage(message);
            } catch (error) {
              console.error('[Cowork] Failed to parse native message:', error);
            }
          } else {
            break;
          }
        }
      });

      socket.on('close', () => {
        console.log('[Cowork] Native messaging host disconnected');
        this.nativeSocket = null;
        this.setState(this.thinClientWs ? 'thinClientConnected' : 'idle');
      });

      socket.on('error', (error: Error) => {
        console.error('[Cowork] Native socket error:', error);
      });
    });

    server.listen(NATIVE_PORT, () => {
      console.log('[Cowork] Native messaging host listening on port', NATIVE_PORT);
    });
  }

  private handleThinClientConnection(ws: WebSocket): void {
    // If we already have a Thin Client, close the old one
    if (this.thinClientWs) {
      console.log('[Cowork] Closing previous Thin Client connection');
      this.thinClientWs.close();
    }

    this.thinClientWs = ws;
    this.lastThinClientPong = Date.now();
    this.setState(this.nativeSocket ? 'fullyConnected' : 'thinClientConnected');

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ThinClientMessage;
        this.handleThinClientMessage(message);
      } catch (error) {
        console.error('[Cowork] Failed to parse Thin Client message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[Cowork] Thin Client disconnected');
      this.thinClientWs = null;
      this.setState(this.nativeSocket ? 'extensionConnected' : 'idle');
    });

    ws.on('error', (error: Error) => {
      console.error('[Cowork] Thin Client WebSocket error:', error);
      this.setState('error');
    });
    
    // Track pong responses
    ws.on('pong', () => {
      this.lastThinClientPong = Date.now();
    });

    // Send welcome message
    this.sendToThinClient({
      id: this.generateId(),
      type: 'connected',
      payload: {
        mode: 'cowork',
        desktopVersion: app.getVersion(),
        extensionConnected: !!this.nativeSocket,
      },
      timestamp: Date.now(),
    });
  }

  private handleThinClientMessage(message: ThinClientMessage): void {
    console.log('[Cowork] Received from Thin Client:', message.type);

    switch (message.type) {
      case 'ping':
        this.sendToThinClient({
          id: this.generateId(),
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'execute':
        if (message.payload) {
          this.executeInBrowser(message.payload as ExecuteRequest)
            .then((result) => {
              this.sendToThinClient({
                id: message.id,
                type: 'execute:result',
                payload: { success: true, result },
                timestamp: Date.now(),
              });
            })
            .catch((error: Error) => {
              this.sendToThinClient({
                id: message.id,
                type: 'execute:error',
                payload: { success: false, error: error.message },
                timestamp: Date.now(),
              });
            });
        }
        break;

      default:
        console.log('[Cowork] Unknown message type:', message.type);
    }
  }

  private handleNativeMessage(message: NativeMessage): void {
    // Handle response to pending request
    if (this.pendingRequests.has(message.id)) {
      const handler = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.type === 'error') {
        handler.reject(new Error((message.payload as { message: string })?.message || 'Unknown error'));
      } else {
        handler.resolve(message.payload);
      }
      return;
    }

    // Handle events from extension
    if (message.type === 'event') {
      this.sendToThinClient({
        id: this.generateId(),
        type: 'extension:event',
        payload: message.payload,
        timestamp: Date.now(),
      });
    }

    // Handle ping
    if (message.type === 'ping') {
      const response: NativeMessage = {
        id: message.id,
        type: 'pong',
        timestamp: Date.now(),
      };
      this.sendNativeMessage(response);
    }
    
    // Handle pong
    if (message.type === 'pong') {
      this.lastNativePong = Date.now();
    }
  }

  private sendNativeMessage(message: NativeMessage): void {
    if (this.nativeSocket) {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
      this.nativeSocket.write(Buffer.concat([lengthBuffer, messageBuffer]));
    }
  }

  private setState(newState: CoworkState): void {
    if (this.state !== newState) {
      console.log('[Cowork] State:', this.state, '→', newState);
      this.state = newState;
      this.emit('stateChanged', newState);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let coworkController: CoworkController | null = null;

export function getCoworkController(): CoworkController {
  if (!coworkController) {
    coworkController = new CoworkController(3010);
  }
  return coworkController;
}

export async function startCoworkMode(): Promise<CoworkController> {
  const controller = getCoworkController();
  await controller.start();
  return controller;
}

export function stopCoworkMode(): void {
  coworkController?.stop();
}

export function isCoworkActive(): boolean {
  return coworkController?.isFullyConnected() || false;
}
