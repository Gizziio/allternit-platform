/**
 * EventServer.ts
 * 
 * WebSocket server implementation for A2R Infrastructure.
 * Handles client connections, authentication, channel subscriptions,
 * heartbeats, reconnection logic, and event distribution.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { RedisPubSub } from './RedisPubSub';
import type { 
  Event, 
  ClientEvent, 
  AuthEvent, 
  SystemEvent,
  HeartbeatEvent,
  HeartbeatAckEvent,
  ChannelSubscribedEvent,
} from './EventTypes';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EventServerOptions {
  port?: number;
  server?: WebSocketServer;
  path?: string;
  redis?: RedisPubSub;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  authTimeout?: number;
  maxClients?: number;
  perMessageDeflate?: boolean;
  verifyClient?: (info: { origin: string; secure: boolean; req: IncomingMessage }) => boolean;
}

export interface ClientInfo {
  id: string;
  socket: WebSocket;
  userId?: string;
  authenticated: boolean;
  channels: Set<string>;
  connectedAt: Date;
  lastHeartbeat: Date;
  heartbeatMisses: number;
  metadata: Record<string, unknown>;
}

export type ConnectionStatus = 'connecting' | 'authenticating' | 'connected' | 'disconnected';

// ============================================================================
// Event Server Class
// ============================================================================

export class EventServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientInfo>();
  private channels = new Map<string, Set<string>>(); // channel -> set of clientIds
  private redisPubSub?: RedisPubSub;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly options: Required<Pick<EventServerOptions, 'heartbeatInterval' | 'heartbeatTimeout' | 'authTimeout' | 'maxClients'>> &
    Pick<EventServerOptions, 'port' | 'path' | 'perMessageDeflate' | 'verifyClient'>;


  constructor(options: EventServerOptions = {}) {
    super();
    
    this.options = {
      port: options.port,
      path: options.path || '/ws',
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatTimeout: options.heartbeatTimeout || 60000,
      authTimeout: options.authTimeout || 30000,
      maxClients: options.maxClients || 10000,
      perMessageDeflate: options.perMessageDeflate ?? false,
      verifyClient: options.verifyClient,
    };

    // Use provided WebSocketServer or create new one
    if (options.server) {
      this.wss = options.server;
    } else {
      this.wss = new WebSocketServer({
        port: this.options.port,
        path: this.options.path,
        perMessageDeflate: this.options.perMessageDeflate,
        verifyClient: this.options.verifyClient,
      });
    }

    // Set up Redis pub/sub if provided
    if (options.redis) {
      this.redisPubSub = options.redis;
      this.setupRedisHandlers();
    }

    // Set up WebSocket server handlers
    this.setupWebSocketHandlers();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start the event server
   */
  async start(): Promise<void> {
    // Start heartbeat checker
    this.startHeartbeatChecker();

    // Connect to Redis if configured
    if (this.redisPubSub && !this.redisPubSub.connected) {
      await this.redisPubSub.connect();
    }

    this.emit('started', { 
      port: this.options.port, 
      path: this.options.path,
      redisEnabled: !!this.redisPubSub,
    });
  }

  /**
   * Stop the event server gracefully
   */
  async stop(): Promise<void> {

    // Stop heartbeat checker
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all client connections
    const closePromises: Promise<void>[] = [];
    for (const [clientId] of this.clients) {
      closePromises.push(this.disconnectClient(clientId, 1001, 'Server shutting down'));
    }
    await Promise.all(closePromises);

    // Close WebSocket server
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });

    // Disconnect from Redis
    if (this.redisPubSub) {
      await this.redisPubSub.disconnect();
    }

    this.emit('stopped');
  }

  /**
   * Subscribe a client to a channel
   */
  async subscribe(clientId: string, channel: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    if (client.channels.has(channel)) {
      return; // Already subscribed
    }

    // Add to local tracking
    client.channels.add(channel);
    
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(clientId);

    // Subscribe to Redis channel for cross-server events
    if (this.redisPubSub) {
      await this.redisPubSub.subscribe(channel);
      await this.redisPubSub.addClientToChannel(clientId, channel);
    }

    // Notify client of subscription
    const event: ChannelSubscribedEvent = {
      type: 'system',
      eventType: 'info',
      message: `Subscribed to channel: ${channel}`,
      channels: Array.from(client.channels),
      timestamp: new Date().toISOString(),
    };
    this.sendToClient(clientId, event);

    this.emit('subscribed', { clientId, channel });
  }

  /**
   * Unsubscribe a client from a channel
   */
  async unsubscribe(clientId: string, channel: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    if (!client.channels.has(channel)) {
      return; // Not subscribed
    }

    // Remove from local tracking
    client.channels.delete(channel);
    
    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      
      // Clean up empty channel
      if (channelClients.size === 0) {
        this.channels.delete(channel);
        
        // Unsubscribe from Redis if no local clients
        if (this.redisPubSub) {
          await this.redisPubSub.unsubscribe(channel);
        }
      }
    }

    // Remove from Redis tracking
    if (this.redisPubSub) {
      await this.redisPubSub.removeClientFromChannel(clientId, channel);
    }

    this.emit('unsubscribed', { clientId, channel });
  }

  /**
   * Unsubscribe a client from all channels
   */
  async unsubscribeAll(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const channels = Array.from(client.channels);
    for (const channel of channels) {
      await this.unsubscribe(clientId, channel);
    }
  }

  /**
   * Publish an event to a specific channel
   */
  async publish(channel: string, event: Event): Promise<void> {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Send to local subscribers
    const channelClients = this.channels.get(channel);
    if (channelClients) {
      for (const clientId of channelClients) {
        this.sendToClient(clientId, event);
      }
    }

    // Publish to Redis for cross-server distribution
    if (this.redisPubSub) {
      await this.redisPubSub.publish(channel, event);
    }

    this.emit('published', { channel, event });
  }

  /**
   * Broadcast an event to all connected clients
   */
  async broadcast(event: Event): Promise<void> {
    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Send to all local clients
    for (const [clientId, client] of this.clients) {
      if (client.authenticated) {
        this.sendToClient(clientId, event);
      }
    }

    // Publish to Redis broadcast channel
    if (this.redisPubSub) {
      await this.redisPubSub.publish('broadcast', event);
    }

    this.emit('broadcast', { event });
  }

  /**
   * Send an event to a specific client
   */
  sendToClient(clientId: string, event: Event): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(event));
      return true;
    } catch (error) {
      this.emit('error', { error, clientId, event });
      return false;
    }
  }

  /**
   * Disconnect a specific client
   */
  async disconnectClient(clientId: string, code = 1000, reason = 'Disconnected'): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Unsubscribe from all channels
    await this.unsubscribeAll(clientId);

    // Close socket
    if (client.socket.readyState === WebSocket.OPEN || client.socket.readyState === WebSocket.CONNECTING) {
      client.socket.close(code, reason);
    }

    // Remove from clients map
    this.clients.delete(clientId);

    // Remove session from Redis
    if (this.redisPubSub) {
      await this.redisPubSub.deleteSession(clientId);
    }

    this.emit('disconnected', { clientId, reason });
  }

  /**
   * Authenticate a client
   */
  async authenticate(clientId: string, token: string): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    // TODO: Implement actual token validation with auth service
    // For now, accept any non-empty token
    const isValid = token && token.length > 0;

    if (isValid) {
      client.authenticated = true;
      client.userId = this.extractUserIdFromToken(token);

      // Store session in Redis
      if (this.redisPubSub) {
        await this.redisPubSub.setSession(clientId, {
          userId: client.userId,
          authenticated: true,
          connectedAt: client.connectedAt.toISOString(),
        });
      }

      // Send auth success event
      const authEvent: AuthEvent = {
        type: 'system',
        eventType: 'auth',
        success: true,
        clientId,
        userId: client.userId,
        message: 'Authentication successful',
        timestamp: new Date().toISOString(),
      };
      this.sendToClient(clientId, authEvent);

      this.emit('authenticated', { clientId, userId: client.userId });
    } else {
      // Send auth failure event
      const authEvent: AuthEvent = {
        type: 'system',
        eventType: 'auth',
        success: false,
        clientId,
        errorMessage: 'Invalid authentication token',
        message: 'Authentication failed',
        timestamp: new Date().toISOString(),
      };
      this.sendToClient(clientId, authEvent);

      // Disconnect after short delay
      setTimeout(() => {
        this.disconnectClient(clientId, 1008, 'Authentication failed');
      }, 1000);
    }

    return isValid === true;
  }

  /**
   * Get client information
   */
  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients subscribed to a channel
   */
  getChannelClients(channel: string): string[] {
    const channelClients = this.channels.get(channel);
    return channelClients ? Array.from(channelClients) : [];
  }

  /**
   * Get server statistics
   */
  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    totalChannels: number;
    uptime: number;
  } {
    let authenticatedCount = 0;
    for (const client of this.clients.values()) {
      if (client.authenticated) {
        authenticatedCount++;
      }
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients: authenticatedCount,
      totalChannels: this.channels.size,
      uptime: process.uptime(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set up WebSocket server event handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      this.handleConnection(socket, req);
    });

    this.wss.on('error', (error: Error) => {
      this.emit('error', { error, source: 'wss' });
    });

    this.wss.on('close', () => {
      this.emit('closed');
    });
  }

  /**
   * Set up Redis pub/sub event handlers
   */
  private setupRedisHandlers(): void {
    if (!this.redisPubSub) return;

    this.redisPubSub.on('message', (channel: string, event: Event) => {
      // Forward Redis messages to local subscribers
      const channelClients = this.channels.get(channel);
      if (channelClients) {
        for (const clientId of channelClients) {
          this.sendToClient(clientId, event);
        }
      }
    });

    this.redisPubSub.on('error', (error) => {
      this.emit('error', { error, source: 'redis' });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, req: IncomingMessage): void {
    // Check max clients limit
    if (this.clients.size >= this.options.maxClients) {
      socket.close(1013, 'Server at capacity');
      return;
    }

    // Generate client ID
    const clientId = this.generateClientId();

    // Create client info
    const clientInfo: ClientInfo = {
      id: clientId,
      socket,
      authenticated: false,
      channels: new Set(),
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      heartbeatMisses: 0,
      metadata: {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    };

    this.clients.set(clientId, clientInfo);

    // Set up socket event handlers
    socket.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    socket.on('close', (code: number, reason: Buffer) => {
      this.handleClose(clientId, code, reason);
    });

    socket.on('error', (error: Error) => {
      this.handleError(clientId, error);
    });

    socket.on('pong', () => {
      this.handlePong(clientId);
    });

    // Set authentication timeout
    setTimeout(() => {
      if (!clientInfo.authenticated && this.clients.has(clientId)) {
        this.disconnectClient(clientId, 1008, 'Authentication timeout');
      }
    }, this.options.authTimeout);

    this.emit('connected', { clientId, ip: req.socket.remoteAddress });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, data: Buffer): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString()) as ClientEvent & Record<string, unknown>;

      // Handle different message types
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(clientId, message as unknown as HeartbeatEvent);
          break;

        default:
          // Handle action-based messages
          if (message.action === 'subscribe' && Array.isArray(message.channels)) {
            for (const channel of message.channels) {
              this.subscribe(clientId, channel).catch(() => {});
            }
          } else if (message.action === 'unsubscribe' && Array.isArray(message.channels)) {
            for (const channel of message.channels) {
              this.unsubscribe(clientId, channel).catch(() => {});
            }
          } else if (message.action === 'auth' && typeof message.token === 'string') {
            this.authenticate(clientId, message.token).catch(() => {});
          }
          break;
      }
    } catch (error) {
      // Send error to client
      const errorEvent: SystemEvent = {
        type: 'system',
        eventType: 'error',
        message: 'Invalid message format',
        code: 'INVALID_MESSAGE',
        timestamp: new Date().toISOString(),
      };
      this.sendToClient(clientId, errorEvent);
    }
  }

  /**
   * Handle heartbeat from client
   */
  private handleHeartbeat(clientId: string, message: HeartbeatEvent): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastHeartbeat = new Date();
    client.heartbeatMisses = 0;

    // Send heartbeat acknowledgment
    const ack: HeartbeatAckEvent & Record<string, unknown> = {
      type: 'heartbeat',
      eventType: 'ack',
      clientTime: message.timestamp,
      serverTime: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Calculate latency if client time is provided
    if (message.timestamp) {
      const clientTime = new Date(message.timestamp).getTime();
      const serverTime = new Date().getTime();
      ack.latency = serverTime - clientTime;
    }

    this.sendToClient(clientId, ack as unknown as Event);
  }

  /**
   * Handle pong response from client
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastHeartbeat = new Date();
    client.heartbeatMisses = 0;
  }

  /**
   * Handle connection close
   */
  private handleClose(clientId: string, code: number, reason: Buffer): void {
    this.disconnectClient(clientId, code, reason.toString()).catch(() => {});
  }

  /**
   * Handle socket error
   */
  private handleError(clientId: string, error: Error): void {
    this.emit('error', { error, clientId, source: 'socket' });
  }

  /**
   * Start heartbeat checker interval
   */
  private startHeartbeatChecker(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();

      for (const [clientId, client] of this.clients) {
        const timeSinceLastHeartbeat = now.getTime() - client.lastHeartbeat.getTime();

        // Check if client has missed too many heartbeats
        if (timeSinceLastHeartbeat > this.options.heartbeatTimeout) {
          client.heartbeatMisses++;

          if (client.heartbeatMisses >= 2) {
            // Disconnect unresponsive client
            this.disconnectClient(clientId, 1001, 'Heartbeat timeout').catch(() => {});
          }
        } else if (timeSinceLastHeartbeat > this.options.heartbeatInterval) {
          // Send ping to check if client is alive
          if (client.socket.readyState === WebSocket.OPEN) {
            client.socket.ping();
          }
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Extract user ID from authentication token
   * TODO: Implement proper JWT validation
   */
  private extractUserIdFromToken(token: string): string | undefined {
    // Placeholder implementation
    // In production, decode and validate JWT token
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.sub || payload.userId;
      }
    } catch {
      // Invalid token format
    }
    return undefined;
  }
}
