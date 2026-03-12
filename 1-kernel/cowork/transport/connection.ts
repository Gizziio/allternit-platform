/**
 * Connection Management Layer
 * 
 * Provides connection pooling, keepalive/heartbeat, reconnection logic,
 * timeout handling, and backpressure management for VM transports.
 * 
 * @module connection
 */

import { EventEmitter } from "events";
import {
  VMConnection,
  VMTransport,
  VMTransportOptions,
  VMTransportError,
  VMTransportErrorCode,
} from "./transport";

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Maximum number of connections in pool */
  maxConnections: number;

  /** Maximum connections per VM */
  maxConnectionsPerVm: number;

  /** Connection idle timeout in milliseconds */
  idleTimeout: number;

  /** Connection maximum lifetime in milliseconds */
  maxLifetime: number;

  /** Health check interval in milliseconds */
  healthCheckInterval: number;

  /** Enable connection pooling */
  enabled: boolean;
}

/**
 * Default connection pool configuration
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 100,
  maxConnectionsPerVm: 10,
  idleTimeout: 300000, // 5 minutes
  maxLifetime: 3600000, // 1 hour
  healthCheckInterval: 30000, // 30 seconds
  enabled: true,
};

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
  /** Maximum number of reconnection attempts */
  maxAttempts: number;

  /** Initial delay between attempts in milliseconds */
  initialDelay: number;

  /** Maximum delay between attempts in milliseconds */
  maxDelay: number;

  /** Backoff multiplier */
  backoffMultiplier: number;

  /** Enable jitter to prevent thundering herd */
  jitter: boolean;
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Connection state
 */
enum ManagedConnectionState {
  IDLE = "idle",
  ACTIVE = "active",
  RECONNECTING = "reconnecting",
  CLOSING = "closing",
  CLOSED = "closed",
  ERROR = "error",
}

/**
 * Managed connection wrapper with lifecycle management
 */
export class ManagedConnection extends EventEmitter {
  readonly id: string;
  readonly vmId: string;
  readonly port: number;

  private connection: VMConnection | null = null;
  private state: ManagedConnectionState = ManagedConnectionState.IDLE;
  private transport: VMTransport;
  private options: VMTransportOptions;
  private reconnectConfig: ReconnectConfig;
  private reconnectAttempts = 0;
  private lastActivity: number = Date.now();
  private createdAt: number = Date.now();
  private idleTimeoutId?: NodeJS.Timeout;
  private healthCheckId?: NodeJS.Timeout;
  private pendingOperations = 0;
  private messageQueue: Buffer[] = [];
  private isProcessingQueue = false;

  constructor(
    id: string,
    vmId: string,
    port: number,
    transport: VMTransport,
    options: VMTransportOptions,
    reconnectConfig: ReconnectConfig = DEFAULT_RECONNECT_CONFIG
  ) {
    super();
    this.id = id;
    this.vmId = vmId;
    this.port = port;
    this.transport = transport;
    this.options = options;
    this.reconnectConfig = reconnectConfig;
  }

  /**
   * Get current connection state
   */
  get currentState(): ManagedConnectionState {
    return this.state;
  }

  /**
   * Check if connection is available for use
   */
  get isAvailable(): boolean {
    return (
      this.state === ManagedConnectionState.IDLE ||
      this.state === ManagedConnectionState.ACTIVE
    );
  }

  /**
   * Check if connection is active
   */
  get isActive(): boolean {
    return this.state === ManagedConnectionState.ACTIVE;
  }

  /**
   * Get underlying connection (if connected)
   */
  get underlyingConnection(): VMConnection | null {
    return this.connection;
  }

  /**
   * Get time since last activity
   */
  get idleTime(): number {
    return Date.now() - this.lastActivity;
  }

  /**
   * Get connection age
   */
  get age(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Get number of pending operations
   */
  get pendingCount(): number {
    return this.pendingOperations;
  }

  /**
   * Establish initial connection
   */
  async connect(): Promise<void> {
    if (this.connection) {
      throw new VMTransportError(
        "Connection already established",
        VMTransportErrorCode.ALREADY_CONNECTED
      );
    }

    this.state = ManagedConnectionState.ACTIVE;

    try {
      this.connection = await this.transport.connect(this.vmId, this.port);
      this.setupConnectionHandlers();
      this.startHealthCheck();
      this.emit("connected");
    } catch (err) {
      this.state = ManagedConnectionState.ERROR;
      throw err;
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.onClose(() => {
      this.handleDisconnection();
    });

    this.connection.onError((err) => {
      this.emit("error", err);
      if (err.isRetryable && this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
        this.scheduleReconnect();
      }
    });

    this.connection.onData((data) => {
      this.lastActivity = Date.now();
      this.emit("data", data);
    });
  }

  private handleDisconnection(): void {
    if (this.state === ManagedConnectionState.CLOSING ||
        this.state === ManagedConnectionState.CLOSED) {
      return;
    }

    this.state = ManagedConnectionState.RECONNECTING;
    this.emit("disconnected");

    if (this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
      this.scheduleReconnect();
    } else {
      this.state = ManagedConnectionState.ERROR;
      this.emit("error", new VMTransportError(
        "Max reconnection attempts exceeded",
        VMTransportErrorCode.CONNECTION_CLOSED
      ));
    }
  }

  private scheduleReconnect(): void {
    const delay = this.calculateReconnectDelay();

    this.emit("reconnecting", {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.reconnectConfig.maxAttempts,
      delay,
    });

    setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const baseDelay =
      this.reconnectConfig.initialDelay *
      Math.pow(this.reconnectConfig.backoffMultiplier, this.reconnectAttempts);

    let delay = Math.min(baseDelay, this.reconnectConfig.maxDelay);

    if (this.reconnectConfig.jitter) {
      // Add ±25% jitter
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    this.reconnectAttempts++;
    return Math.floor(delay);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.state === ManagedConnectionState.CLOSING ||
        this.state === ManagedConnectionState.CLOSED) {
      return;
    }

    try {
      this.connection = await this.transport.connect(this.vmId, this.port);
      this.reconnectAttempts = 0;
      this.state = ManagedConnectionState.ACTIVE;
      this.setupConnectionHandlers();
      this.emit("reconnected");

      // Process any queued messages
      this.processMessageQueue();
    } catch (err) {
      if (this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
        this.scheduleReconnect();
      } else {
        this.state = ManagedConnectionState.ERROR;
        this.emit("error", new VMTransportError(
          "Reconnection failed after max attempts",
          VMTransportErrorCode.CONNECTION_CLOSED,
          err instanceof Error ? err : undefined
        ));
      }
    }
  }

  /**
   * Read data from connection
   */
  async read(): Promise<Buffer | null> {
    if (!this.connection) {
      throw new VMTransportError(
        "Not connected",
        VMTransportErrorCode.NOT_CONNECTED
      );
    }

    this.pendingOperations++;
    this.state = ManagedConnectionState.ACTIVE;

    try {
      const data = await this.connection.read();
      this.lastActivity = Date.now();
      return data;
    } catch (err) {
      throw err;
    } finally {
      this.pendingOperations--;
      if (this.pendingOperations === 0) {
        this.state = ManagedConnectionState.IDLE;
      }
    }
  }

  /**
   * Write data to connection with backpressure handling
   */
  async write(data: Buffer): Promise<void> {
    if (!this.connection || !this.isAvailable) {
      // Queue message if reconnecting
      if (this.state === ManagedConnectionState.RECONNECTING) {
        if (this.messageQueue.length < 1000) { // Max queue size
          this.messageQueue.push(data);
        } else {
          throw new VMTransportError(
            "Message queue full",
            VMTransportErrorCode.BUFFER_OVERFLOW
          );
        }
        return;
      }

      throw new VMTransportError(
        "Not connected",
        VMTransportErrorCode.NOT_CONNECTED
      );
    }

    this.pendingOperations++;
    this.state = ManagedConnectionState.ACTIVE;

    try {
      await this.connection.write(data);
      this.lastActivity = Date.now();
    } catch (err) {
      // Queue for retry on reconnect
      if (this.messageQueue.length < 1000) {
        this.messageQueue.push(data);
      }
      throw err;
    } finally {
      this.pendingOperations--;
      if (this.pendingOperations === 0) {
        this.state = ManagedConnectionState.IDLE;
      }
    }
  }

  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0 && this.isAvailable) {
      const message = this.messageQueue.shift()!;
      try {
        await this.write(message);
      } catch (err) {
        // Put message back at front of queue
        this.messageQueue.unshift(message);
        break;
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send heartbeat/ping
   */
  async sendHeartbeat(): Promise<boolean> {
    if (!this.connection || !this.isAvailable) {
      return false;
    }

    try {
      // Send empty frame as heartbeat
      await this.connection.write(Buffer.from([0, 0, 0, 0]));
      return true;
    } catch {
      return false;
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckId) {
      clearInterval(this.healthCheckId);
    }

    this.healthCheckId = setInterval(() => {
      if (this.isAvailable) {
        this.sendHeartbeat().catch(() => {
          // Heartbeat failed, will trigger reconnect
        });
      }
    }, this.options.keepaliveInterval || 30000);
  }

  /**
   * Close connection gracefully
   */
  async close(): Promise<void> {
    this.state = ManagedConnectionState.CLOSING;

    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
    }

    if (this.healthCheckId) {
      clearInterval(this.healthCheckId);
    }

    // Wait for pending operations
    while (this.pendingOperations > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.connection) {
      await this.connection.close();
    }

    this.state = ManagedConnectionState.CLOSED;
    this.emit("closed");
  }

  /**
   * Force close connection
   */
  destroy(): void {
    this.state = ManagedConnectionState.CLOSED;

    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
    }

    if (this.healthCheckId) {
      clearInterval(this.healthCheckId);
    }

    if (this.connection) {
      this.connection.destroy();
    }

    this.messageQueue = [];
    this.emit("closed");
  }
}

/**
 * Connection pool manager
 */
export class ConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private transport: VMTransport;
  private options: VMTransportOptions;
  private reconnectConfig: ReconnectConfig;
  private pools: Map<string, ManagedConnection[]> = new Map();
  private allConnections: Map<string, ManagedConnection> = new Maps();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    transport: VMTransport,
    config: Partial<ConnectionPoolConfig> = {},
    options: VMTransportOptions = {},
    reconnectConfig: Partial<ReconnectConfig> = {}
  ) {
    super();
    this.transport = transport;
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.options = options;
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };

    if (this.config.enabled) {
      this.startCleanupInterval();
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.healthCheckInterval);
  }

  /**
   * Get or create a connection to a VM
   */
  async acquire(vmId: string, port: number): Promise<ManagedConnection> {
    const poolKey = `${vmId}:${port}`;

    // Check for available existing connection
    const pool = this.pools.get(poolKey) || [];
    const availableConn = pool.find((c) => c.isAvailable && c.pendingCount === 0);

    if (availableConn) {
      return availableConn;
    }

    // Check pool size limits
    if (pool.length >= this.config.maxConnectionsPerVm) {
      throw new VMTransportError(
        `Max connections per VM reached for ${vmId}:${port}`,
        VMTransportErrorCode.INTERNAL_ERROR
      );
    }

    if (this.allConnections.size >= this.config.maxConnections) {
      // Try to clean up idle connections first
      this.cleanupIdleConnections();

      if (this.allConnections.size >= this.config.maxConnections) {
        throw new VMTransportError(
          "Max connections reached",
          VMTransportErrorCode.INTERNAL_ERROR
        );
      }
    }

    // Create new connection
    const conn = new ManagedConnection(
      `pool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vmId,
      port,
      this.transport,
      this.options,
      this.reconnectConfig
    );

    await conn.connect();

    // Add to pools
    pool.push(conn);
    this.pools.set(poolKey, pool);
    this.allConnections.set(conn.id, conn);

    // Setup cleanup on close
    conn.on("closed", () => {
      this.removeConnection(conn);
    });

    this.emit("connectionAcquired", { vmId, port, connectionId: conn.id });

    return conn;
  }

  /**
   * Release a connection back to the pool
   */
  release(conn: ManagedConnection): void {
    // Connection is automatically returned to pool state
    // Just ensure it's not actively being used
    this.emit("connectionReleased", { connectionId: conn.id });
  }

  /**
   * Remove connection from pool
   */
  private removeConnection(conn: ManagedConnection): void {
    const poolKey = `${conn.vmId}:${conn.port}`;
    const pool = this.pools.get(poolKey);

    if (pool) {
      const idx = pool.indexOf(conn);
      if (idx >= 0) {
        pool.splice(idx, 1);
      }

      if (pool.length === 0) {
        this.pools.delete(poolKey);
      }
    }

    this.allConnections.delete(conn.id);
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();

    for (const conn of this.allConnections.values()) {
      // Close connections that have been idle too long
      if (
        conn.currentState === ManagedConnectionState.IDLE &&
        conn.idleTime > this.config.idleTimeout
      ) {
        conn.close().catch(() => {});
        continue;
      }

      // Close connections that have exceeded max lifetime
      if (conn.age > this.config.maxLifetime) {
        conn.close().catch(() => {});
        continue;
      }

      // Close errored connections
      if (conn.currentState === ManagedConnectionState.ERROR) {
        conn.close().catch(() => {});
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    reconnectingConnections: number;
    pools: number;
  } {
    let active = 0;
    let idle = 0;
    let reconnecting = 0;

    for (const conn of this.allConnections.values()) {
      if (conn.isActive) active++;
      else if (conn.currentState === ManagedConnectionState.IDLE) idle++;
      else if (conn.currentState === ManagedConnectionState.RECONNECTING) reconnecting++;
    }

    return {
      totalConnections: this.allConnections.size,
      activeConnections: active,
      idleConnections: idle,
      reconnectingConnections: reconnecting,
      pools: this.pools.size,
    };
  }

  /**
   * Close all connections and stop pool
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const closePromises = Array.from(this.allConnections.values()).map((conn) =>
      conn.close().catch(() => {})
    );

    await Promise.all(closePromises);

    this.pools.clear();
    this.allConnections.clear();
  }

  /**
   * Get all connections for a VM
   */
  getConnectionsForVm(vmId: string): ManagedConnection[] {
    const connections: ManagedConnection[] = [];
    for (const conn of this.allConnections.values()) {
      if (conn.vmId === vmId) {
        connections.push(conn);
      }
    }
    return connections;
  }

  /**
   * Close all connections to a specific VM
   */
  async closeVmConnections(vmId: string): Promise<void> {
    const connections = this.getConnectionsForVm(vmId);
    await Promise.all(connections.map((c) => c.close().catch(() => {})));
  }
}

/**
 * Connection manager with high-level API
 */
export class ConnectionManager extends EventEmitter {
  private transport: VMTransport;
  private pool?: ConnectionPool;

  constructor(
    transport: VMTransport,
    usePool = true,
    poolConfig?: Partial<ConnectionPoolConfig>,
    options?: VMTransportOptions,
    reconnectConfig?: Partial<ReconnectConfig>
  ) {
    super();
    this.transport = transport;

    if (usePool) {
      this.pool = new ConnectionPool(
        transport,
        poolConfig,
        options,
        reconnectConfig
      );
    }
  }

  /**
   * Connect to a VM (direct or pooled)
   */
  async connect(vmId: string, port: number): Promise<ManagedConnection | VMConnection> {
    if (this.pool) {
      return this.pool.acquire(vmId, port);
    }

    const conn = new ManagedConnection(
      `direct-${Date.now()}`,
      vmId,
      port,
      this.transport,
      {},
      DEFAULT_RECONNECT_CONFIG
    );

    await conn.connect();
    return conn;
  }

  /**
   * Execute operation with automatic connection management
   */
  async withConnection<T>(
    vmId: string,
    port: number,
    operation: (conn: ManagedConnection) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new VMTransportError(
        "Connection pooling required for withConnection",
        VMTransportErrorCode.INTERNAL_ERROR
      );
    }

    const conn = await this.pool.acquire(vmId, port);

    try {
      const result = await operation(conn);
      this.pool.release(conn);
      return result;
    } catch (err) {
      // Don't release on error - connection may be bad
      throw err;
    }
  }

  /**
   * Get connection statistics
   */
  getStats():
    | ReturnType<ConnectionPool["getStats"]>
    | { pooled: false; transportType: string } {
    if (this.pool) {
      return { pooled: true, ...this.pool.getStats() } as any;
    }
    return { pooled: false, transportType: this.transport.type };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
    }
  }
}

export default ConnectionManager;
