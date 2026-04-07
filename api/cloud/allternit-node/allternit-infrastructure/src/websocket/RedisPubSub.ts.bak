/**
 * RedisPubSub.ts
 * 
 * Redis-based publish/subscribe implementation for horizontal scaling.
 * Enables WebSocket events to be distributed across multiple server instances.
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import type { Event } from './EventTypes';

export interface RedisPubSubOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | void;
  enableOfflineQueue?: boolean;
  maxRetriesPerRequest?: number;
}

export interface PubSubMessage {
  channel: string;
  event: Event;
  serverId: string;
  timestamp: string;
}

/**
 * Redis Pub/Sub manager for horizontal scaling of WebSocket events.
 * Uses Redis as a message broker to distribute events across multiple server instances.
 */
export class RedisPubSub extends EventEmitter {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly options: RedisPubSubOptions;
  private readonly serverId: string;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly subscribedChannels = new Set<string>();

  constructor(options: RedisPubSubOptions = {}) {
    super();
    this.options = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: 'a2r:ws:',
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      ...options,
    };
    this.serverId = this.generateServerId();
  }

  /**
   * Initialize Redis connections
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create publisher connection
      this.publisher = new Redis({
        host: this.options.host,
        port: this.options.port,
        password: this.options.password,
        db: this.options.db,
        keyPrefix: this.options.keyPrefix,
        retryStrategy: this.options.retryStrategy,
        enableOfflineQueue: this.options.enableOfflineQueue,
        maxRetriesPerRequest: this.options.maxRetriesPerRequest,
      });

      // Create subscriber connection (separate connection for subscriptions)
      this.subscriber = new Redis({
        host: this.options.host,
        port: this.options.port,
        password: this.options.password,
        db: this.options.db,
        keyPrefix: this.options.keyPrefix,
        retryStrategy: this.options.retryStrategy,
        enableOfflineQueue: this.options.enableOfflineQueue,
        maxRetriesPerRequest: this.options.maxRetriesPerRequest,
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connections to be ready
      await Promise.all([
        this.waitForReady(this.publisher),
        this.waitForReady(this.subscriber),
      ]);

      this.isConnected = true;
      this.emit('connected');

      // Re-subscribe to any previously subscribed channels
      if (this.subscribedChannels.size > 0) {
        for (const channel of this.subscribedChannels) {
          await this.subscriber?.subscribe(channel);
        }
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const disconnectPromises: Promise<void>[] = [];

    if (this.publisher) {
      disconnectPromises.push(this.publisher.quit() as unknown as Promise<void>);
      this.publisher = null;
    }

    if (this.subscriber) {
      disconnectPromises.push(this.subscriber.quit() as unknown as Promise<void>);
      this.subscriber = null;
    }

    await Promise.all(disconnectPromises);
    this.isConnected = false;
    this.subscribedChannels.clear();
    this.emit('disconnected');
  }

  /**
   * Publish an event to a channel
   */
  async publish(channel: string, event: Event): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      throw new Error('RedisPubSub not connected');
    }

    const message: PubSubMessage = {
      channel,
      event,
      serverId: this.serverId,
      timestamp: new Date().toISOString(),
    };

    const channelKey = this.getChannelKey(channel);
    await this.publisher.publish(channelKey, JSON.stringify(message));
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      throw new Error('RedisPubSub not connected');
    }

    const channelKey = this.getChannelKey(channel);
    
    if (!this.subscribedChannels.has(channelKey)) {
      await this.subscriber.subscribe(channelKey);
      this.subscribedChannels.add(channelKey);
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      return;
    }

    const channelKey = this.getChannelKey(channel);
    
    if (this.subscribedChannels.has(channelKey)) {
      await this.subscriber.unsubscribe(channelKey);
      this.subscribedChannels.delete(channelKey);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    if (!this.subscriber || !this.isConnected) {
      return;
    }

    await this.subscriber.unsubscribe(...this.subscribedChannels);
    this.subscribedChannels.clear();
  }

  /**
   * Check if connected to Redis
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the server ID
   */
  getServerId(): string {
    return this.serverId;
  }

  /**
   * Get list of subscribed channels
   */
  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels).map(key => 
      key.replace(this.options.keyPrefix || '', '')
    );
  }

  /**
   * Get Redis connection health status
   */
  getHealth(): { publisher: boolean; subscriber: boolean; connected: boolean } {
    return {
      publisher: this.publisher?.status === 'ready' || false,
      subscriber: this.subscriber?.status === 'ready' || false,
      connected: this.isConnected,
    };
  }

  /**
   * Store client session data in Redis
   */
  async setSession(clientId: string, data: Record<string, unknown>, ttl = 3600): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      throw new Error('RedisPubSub not connected');
    }

    const key = `session:${clientId}`;
    await this.publisher.setex(key, ttl, JSON.stringify(data));
  }

  /**
   * Get client session data from Redis
   */
  async getSession(clientId: string): Promise<Record<string, unknown> | null> {
    if (!this.publisher || !this.isConnected) {
      throw new Error('RedisPubSub not connected');
    }

    const key = `session:${clientId}`;
    const data = await this.publisher.get(key);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data) as Record<string, unknown>;
  }

  /**
   * Delete client session data from Redis
   */
  async deleteSession(clientId: string): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      return;
    }

    const key = `session:${clientId}`;
    await this.publisher.del(key);
  }

  /**
   * Add client to a channel's subscriber set
   */
  async addClientToChannel(clientId: string, channel: string): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      throw new Error('RedisPubSub not connected');
    }

    const key = `channel:${channel}:clients`;
    await this.publisher.sadd(key, clientId);
  }

  /**
   * Remove client from a channel's subscriber set
   */
  async removeClientFromChannel(clientId: string, channel: string): Promise<void> {
    if (!this.publisher || !this.isConnected) {
      return;
    }

    const key = `channel:${channel}:clients`;
    await this.publisher.srem(key, clientId);
  }

  /**
   * Get all clients subscribed to a channel
   */
  async getChannelClients(channel: string): Promise<string[]> {
    if (!this.publisher || !this.isConnected) {
      return [];
    }

    const key = `channel:${channel}:clients`;
    return await this.publisher.smembers(key);
  }

  /**
   * Generate a unique server ID
   */
  private generateServerId(): string {
    return `server-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get the full channel key with prefix
   */
  private getChannelKey(channel: string): string {
    return `${this.options.keyPrefix}channel:${channel}`;
  }

  /**
   * Wait for Redis connection to be ready
   */
  private waitForReady(redis: Redis): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redis.status === 'ready') {
        resolve();
        return;
      }

      const onReady = (): void => {
        redis.removeListener('error', onError);
        resolve();
      };

      const onError = (err: Error): void => {
        redis.removeListener('ready', onReady);
        reject(err);
      };

      redis.once('ready', onReady);
      redis.once('error', onError);

      // Timeout after 10 seconds
      setTimeout(() => {
        redis.removeListener('ready', onReady);
        redis.removeListener('error', onError);
        reject(new Error('Redis connection timeout'));
      }, 10000);
    });
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.publisher || !this.subscriber) {
      return;
    }

    // Publisher events
    this.publisher.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.publisher.on('close', () => {
      this.handleDisconnect();
    });

    // Subscriber events
    this.subscriber.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.subscriber.on('close', () => {
      this.handleDisconnect();
    });

    // Handle incoming messages
    this.subscriber.on('message', (channelKey: string, message: string) => {
      try {
        const parsedMessage: PubSubMessage = JSON.parse(message);
        
        // Don't process messages from this server (already handled locally)
        if (parsedMessage.serverId === this.serverId) {
          return;
        }

        const channel = channelKey.replace(this.options.keyPrefix || '', '').replace('channel:', '');
        this.emit('message', channel, parsedMessage.event, parsedMessage);
      } catch (error) {
        this.emit('error', new Error(`Failed to parse pubsub message: ${error}`));
      }
    });
  }

  /**
   * Handle Redis disconnection
   */
  private handleDisconnect(): void {
    if (!this.isConnected) {
      return;
    }

    this.isConnected = false;
    this.emit('disconnected');

    // Attempt to reconnect after delay
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection will be handled by retry strategy
      });
    }, 5000);
  }
}
