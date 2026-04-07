import { FastifyInstance } from 'fastify';
import { SocketStream } from '@fastify/websocket';
import { createSubscriber } from '../config/redis';
import { logger } from '../utils/logger';
import config from '../config';

interface WebSocketClient {
  id: string;
  socket: SocketStream;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastPing: Date;
}

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  id?: string;
}

export class WebSocketService {
  private clients: Map<string, WebSocketClient>;
  private subscribers: Map<string, ReturnType<typeof createSubscriber>>;
  private heartbeatInterval: NodeJS.Timeout | null;

  constructor() {
    this.clients = new Map();
    this.subscribers = new Map();
    this.heartbeatInterval = null;
  }

  /**
   * Initialize WebSocket service
   */
  initialize(_server: FastifyInstance): void {
    this.startHeartbeat();
    logger.info('WebSocket service initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(socket: SocketStream, req: any): void {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    this.clients.set(clientId, client);
    logger.info('WebSocket client connected', { clientId, ip: req.socket.remoteAddress });

    // Send welcome message
    this.sendMessage(client, {
      type: 'connected',
      data: { clientId, timestamp: new Date().toISOString() },
    });

    // Handle incoming messages
    socket.socket.on('message', (message: Buffer) => {
      try {
        const data: WebSocketMessage = JSON.parse(message.toString());
        this.handleMessage(client, data);
      } catch (error) {
        logger.error('Failed to parse WebSocket message', { clientId, error });
        this.sendError(client, 'Invalid message format');
      }
    });

    // Handle close
    socket.socket.on('close', (code: number, reason: string) => {
      logger.info('WebSocket client disconnected', { clientId, code, reason });
      this.removeClient(clientId);
    });

    // Handle errors
    socket.socket.on('error', (error: Error) => {
      logger.error('WebSocket client error', { clientId, error: error.message });
    });

    // Handle pong (for heartbeat)
    socket.socket.on('pong', () => {
      client.lastPing = new Date();
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WebSocketClient, message: WebSocketMessage): void {
    logger.debug('WebSocket message received', { clientId: client.id, type: message.type });

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(client, message.channel);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client, message.channel);
        break;
      case 'ping':
        this.sendMessage(client, { type: 'pong', data: { timestamp: new Date().toISOString() } });
        break;
      case 'deployment:subscribe':
        this.handleSubscribe(client, `deployment:${message.id}:events`);
        break;
      case 'environment:subscribe':
        this.handleSubscribe(client, `environment:${message.id}:events`);
        break;
      default:
        this.sendError(client, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle channel subscription
   */
  private handleSubscribe(client: WebSocketClient, channel?: string): void {
    if (!channel) {
      this.sendError(client, 'Channel is required for subscription');
      return;
    }

    client.subscriptions.add(channel);

    // Create Redis subscriber for this channel if not exists
    if (!this.subscribers.has(channel)) {
      const subscriber = createSubscriber();
      this.subscribers.set(channel, subscriber);

      subscriber.subscribe(channel, (err) => {
        if (err) {
          logger.error('Failed to subscribe to Redis channel', { channel, error: err.message });
          return;
        }
        logger.debug('Subscribed to Redis channel', { channel });
      });

      subscriber.on('message', (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          this.broadcastToChannel(channel, message);
        }
      });
    }

    this.sendMessage(client, {
      type: 'subscribed',
      channel,
      data: { timestamp: new Date().toISOString() },
    });

    logger.debug('Client subscribed to channel', { clientId: client.id, channel });
  }

  /**
   * Handle channel unsubscription
   */
  private handleUnsubscribe(client: WebSocketClient, channel?: string): void {
    if (!channel) {
      this.sendError(client, 'Channel is required for unsubscription');
      return;
    }

    client.subscriptions.delete(channel);

    // Check if any other clients are subscribed to this channel
    let hasSubscribers = false;
    for (const c of this.clients.values()) {
      if (c.subscriptions.has(channel)) {
        hasSubscribers = true;
        break;
      }
    }

    // If no subscribers, unsubscribe from Redis
    if (!hasSubscribers) {
      const subscriber = this.subscribers.get(channel);
      if (subscriber) {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        this.subscribers.delete(channel);
        logger.debug('Unsubscribed from Redis channel', { channel });
      }
    }

    this.sendMessage(client, {
      type: 'unsubscribed',
      channel,
      data: { timestamp: new Date().toISOString() },
    });

    logger.debug('Client unsubscribed from channel', { clientId: client.id, channel });
  }

  /**
   * Broadcast message to all clients subscribed to a channel
   */
  private broadcastToChannel(channel: string, message: string): void {
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel)) {
        try {
          // Check if the message is already a JSON string
          let data: any;
          try {
            data = JSON.parse(message);
          } catch {
            data = message;
          }

          this.sendMessage(client, {
            type: 'message',
            channel,
            data,
          });
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to client', { clientId: client.id, error });
        }
      }
    }

    logger.debug('Message broadcasted to channel', { channel, recipientCount: sentCount });
  }

  /**
   * Send message to a specific client
   */
  private sendMessage(client: WebSocketClient, message: WebSocketMessage): void {
    try {
      if (client.socket.socket.readyState === 1) { // OPEN
        client.socket.socket.send(JSON.stringify(message));
      }
    } catch (error) {
      logger.error('Failed to send WebSocket message', { clientId: client.id, error });
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: WebSocketClient, error: string): void {
    this.sendMessage(client, {
      type: 'error',
      data: { message: error, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Remove client and clean up
   */
  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Unsubscribe from all channels
    for (const channel of client.subscriptions) {
      this.handleUnsubscribe(client, channel);
    }

    this.clients.delete(clientId);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start heartbeat to check client connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = config.websocket.heartbeatInterval * 2;

      for (const [clientId, client] of this.clients) {
        // Check if client hasn't responded to ping
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          logger.warn('WebSocket client timed out', { clientId });
          client.socket.socket.terminate();
          this.removeClient(clientId);
          continue;
        }

        // Send ping
        if (client.socket.socket.readyState === 1) {
          client.socket.socket.ping();
        }
      }
    }, config.websocket.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get active subscriptions count
   */
  getSubscriptionCount(): number {
    return this.subscribers.size;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      this.sendMessage(client, message);
    }
  }

  /**
   * Shutdown WebSocket service
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.socket.socket.close();
      this.removeClient(clientId);
    }

    // Close all Redis subscribers
    for (const [_channel, subscriber] of this.subscribers) {
      await subscriber.quit();
    }
    this.subscribers.clear();

    logger.info('WebSocket service shut down');
  }
}

export default new WebSocketService();
