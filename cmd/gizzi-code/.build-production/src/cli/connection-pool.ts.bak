/**
 * Connection Pool
 *
 * Manages a pool of daemon client connections for efficient reuse.
 * Implements connection limiting, health checking, and automatic cleanup.
 *
 * @module @/cli/connection-pool
 */

import { DaemonClient } from "@/cli/daemon-client"
import { Log } from "@/shared/util/log"
import { SocketError } from "@/cli/sessions/errors"

const log = Log.create({ service: "connection-pool" })

/**
 * Pooled connection wrapper with metadata
 */
interface PooledConnection {
  /** The daemon client */
  client: DaemonClient
  /** Whether the connection is currently in use */
  inUse: boolean
  /** Last time the connection was used */
  lastUsed: number
  /** Number of times this connection has been used */
  useCount: number
  /** Whether the connection is healthy */
  healthy: boolean
}

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Path to Unix socket */
  readonly socketPath: string
  /** Maximum number of connections (default: 5) */
  readonly maxConnections?: number
  /** Connection timeout in milliseconds (default: 30000) */
  readonly connectionTimeout?: number
  /** Maximum age of a connection before recycling in milliseconds (default: 5 minutes) */
  readonly maxConnectionAge?: number
  /** Maximum uses before recycling a connection (default: 100) */
  readonly maxUses?: number
  /** Interval for cleanup of stale connections in milliseconds (default: 30 seconds) */
  readonly cleanupInterval?: number
}

/**
 * Connection pool for daemon clients
 *
 * Manages a pool of reusable connections to the A2R Desktop daemon.
 * Automatically handles connection limits, health checking, and cleanup
 * of stale connections.
 *
 * @example
 * ```typescript
 * const pool = new ConnectionPool({
 *   socketPath: "/var/run/a2r/desktop-vm.sock",
 *   maxConnections: 5
 * })
 *
 * // Use a connection
 * const result = await pool.withConnection(async (client) => {
 *   return await client.execute({ command: "ls -la" })
 * })
 * ```
 */
export class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map()
  private socketPath: string
  private maxConnections: number
  private connectionTimeout: number
  private maxConnectionAge: number
  private maxUses: number
  private cleanupInterval: number
  private cleanupTimer?: ReturnType<typeof setInterval>
  private connectionId = 0
  private waitQueue: Array<{
    resolve: (client: DaemonClient) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
  }> = []

  /**
   * Create a new connection pool
   *
   * @param config - Pool configuration
   */
  constructor(config: ConnectionPoolConfig) {
    this.socketPath = config.socketPath
    this.maxConnections = config.maxConnections ?? 5
    this.connectionTimeout = config.connectionTimeout ?? 30000
    this.maxConnectionAge = config.maxConnectionAge ?? 5 * 60 * 1000 // 5 minutes
    this.maxUses = config.maxUses ?? 100
    this.cleanupInterval = config.cleanupInterval ?? 30000 // 30 seconds

    // Start cleanup interval
    this.startCleanup()

    log.info("Connection pool initialized", {
      socketPath: this.socketPath,
      maxConnections: this.maxConnections,
    })
  }

  /**
   * Acquire a connection from the pool
   *
   * Returns an existing available connection or creates a new one.
   * Waits if all connections are in use until one becomes available.
   *
   * @returns Promise resolving to a daemon client
   * @throws {SocketError} If unable to create new connection
   */
  async acquire(): Promise<DaemonClient> {
    // Try to find an available existing connection
    for (const [id, conn] of this.connections) {
      if (!conn.inUse && conn.healthy) {
        // Verify connection is still alive
        const isAlive = await this.checkHealth(conn)
        if (isAlive) {
          conn.inUse = true
          conn.lastUsed = Date.now()
          conn.useCount++
          log.debug("Reusing existing connection", { id, useCount: conn.useCount })
          return conn.client
        } else {
          // Connection is dead, remove it
          await this.removeConnection(id)
        }
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.maxConnections) {
      return this.createConnection()
    }

    // Wait for a connection to become available
    log.debug("All connections in use, waiting...")
    return this.waitForConnection()
  }

  /**
   * Release a connection back to the pool
   *
   * @param client - The client to release
   */
  release(client: DaemonClient): void {
    for (const [id, conn] of this.connections) {
      if (conn.client === client) {
        conn.inUse = false
        conn.lastUsed = Date.now()
        log.debug("Connection released", { id })

        // Check if connection should be recycled due to age or use count
        if (this.shouldRecycle(conn)) {
          void this.removeConnection(id)
        }

        // Fulfill any waiting requests
        this.fulfillWaitQueue()
        return
      }
    }
    log.warn("Released unknown connection")
  }

  /**
   * Execute a function with a connection from the pool
   *
   * Automatically acquires a connection, executes the function,
   * and releases the connection regardless of success or failure.
   *
   * @param fn - Function to execute with the connection
   * @returns Promise resolving to the function result
   * @throws Error if the function throws
   *
   * @example
   * ```typescript
   * const result = await pool.withConnection(async (client) => {
   *   const status = await client.getVMStatus()
   *   return await client.execute({ command: "echo hello" })
   * })
   * ```
   */
  async withConnection<T>(fn: (client: DaemonClient) => Promise<T>): Promise<T> {
    const client = await this.acquire()
    try {
      return await fn(client)
    } finally {
      this.release(client)
    }
  }

  /**
   * Dispose of the pool and all connections
   *
   * Closes all connections and stops the cleanup timer.
   * Should be called when the pool is no longer needed.
   */
  async dispose(): Promise<void> {
    log.info("Disposing connection pool")

    // Stop cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      clearTimeout(waiter.timeout)
      waiter.reject(new SocketError("Connection pool disposed"))
    }
    this.waitQueue = []

    // Close all connections
    const closePromises: Promise<void>[] = []
    for (const [id, conn] of this.connections) {
      closePromises.push(
        conn.client.close().catch((error) => {
          log.error("Error closing connection during dispose", {
            id,
            error: error instanceof Error ? error.message : String(error),
          })
        })
      )
    }

    await Promise.all(closePromises)
    this.connections.clear()
    log.info("Connection pool disposed")
  }

  /**
   * Get current pool statistics
   *
   * @returns Pool statistics
   */
  getStats(): {
    total: number
    inUse: number
    available: number
    unhealthy: number
    waiting: number
  } {
    let inUse = 0
    let unhealthy = 0

    for (const conn of this.connections.values()) {
      if (conn.inUse) inUse++
      if (!conn.healthy) unhealthy++
    }

    return {
      total: this.connections.size,
      inUse,
      available: this.connections.size - inUse - unhealthy,
      unhealthy,
      waiting: this.waitQueue.length,
    }
  }

  /**
   * Create a new connection
   */
  private async createConnection(): Promise<DaemonClient> {
    const id = `conn_${++this.connectionId}_${Date.now()}`
    log.debug("Creating new connection", { id })

    try {
      const client = new DaemonClient(this.socketPath, this.connectionTimeout)

      // Verify connection is healthy
      const isHealthy = await client.ping()
      if (!isHealthy) {
        await client.close()
        throw new SocketError("Failed to establish healthy connection")
      }

      const conn: PooledConnection = {
        client,
        inUse: true,
        lastUsed: Date.now(),
        useCount: 1,
        healthy: true,
      }

      this.connections.set(id, conn)
      log.info("New connection created", { id, totalConnections: this.connections.size })

      return client
    } catch (error) {
      log.error("Failed to create connection", {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Remove a connection from the pool
   */
  private async removeConnection(id: string): Promise<void> {
    const conn = this.connections.get(id)
    if (!conn) return

    log.debug("Removing connection", { id, useCount: conn.useCount })
    this.connections.delete(id)

    try {
      await conn.client.close()
    } catch (error) {
      log.error("Error closing connection", {
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Wait for a connection to become available
   */
  private waitForConnection(): Promise<DaemonClient> {
    return new Promise((resolve, reject) => {
      // Set timeout for wait
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((w) => w.resolve === resolve)
        if (index !== -1) {
          this.waitQueue.splice(index, 1)
        }
        reject(new SocketError("Timeout waiting for available connection"))
      }, this.connectionTimeout)

      this.waitQueue.push({ resolve, reject, timeout })
    })
  }

  /**
   * Fulfill waiting requests with available connections
   */
  private fulfillWaitQueue(): void {
    while (this.waitQueue.length > 0) {
      // Find available connection
      let availableConn: PooledConnection | undefined
      for (const conn of this.connections.values()) {
        if (!conn.inUse && conn.healthy) {
          availableConn = conn
          break
        }
      }

      if (!availableConn) break

      // Get next waiter
      const waiter = this.waitQueue.shift()
      if (!waiter) break

      // Fulfill the request
      clearTimeout(waiter.timeout)
      availableConn.inUse = true
      availableConn.lastUsed = Date.now()
      availableConn.useCount++
      waiter.resolve(availableConn.client)
    }
  }

  /**
   * Check if a connection is healthy
   */
  private async checkHealth(conn: PooledConnection): Promise<boolean> {
    try {
      const isAlive = await conn.client.ping()
      conn.healthy = isAlive
      return isAlive
    } catch {
      conn.healthy = false
      return false
    }
  }

  /**
   * Check if a connection should be recycled
   */
  private shouldRecycle(conn: PooledConnection): boolean {
    const age = Date.now() - conn.lastUsed
    return age > this.maxConnectionAge || conn.useCount >= this.maxUses
  }

  /**
   * Start the cleanup interval
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.cleanupInterval)
  }

  /**
   * Perform periodic cleanup of stale connections
   */
  private async performCleanup(): Promise<void> {
    const toRemove: string[] = []

    for (const [id, conn] of this.connections) {
      // Skip connections in use
      if (conn.inUse) continue

      // Check age
      const age = Date.now() - conn.lastUsed
      if (age > this.maxConnectionAge) {
        log.debug("Connection expired due to age", { id, age })
        toRemove.push(id)
        continue
      }

      // Check if unhealthy
      const isHealthy = await this.checkHealth(conn)
      if (!isHealthy) {
        log.debug("Removing unhealthy connection", { id })
        toRemove.push(id)
      }
    }

    // Remove stale connections
    for (const id of toRemove) {
      await this.removeConnection(id)
    }

    if (toRemove.length > 0) {
      log.info("Cleanup complete", { removed: toRemove.length, remaining: this.connections.size })
    }
  }
}
