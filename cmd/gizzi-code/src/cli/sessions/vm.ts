/**
 * VM Session Implementation
 *
 * Provides a Session interface that executes commands through the Allternit Desktop
 * daemon via Unix socket. This enables VM-based command execution with proper
 * sandboxing and resource management.
 *
 * @module @/cli/sessions/vm
 */

import type net from "net"
import { promises as fs } from "fs"
import { DaemonClient } from "@/cli/daemon-client"
import { ConnectionPool } from "@/cli/connection-pool"
import { DaemonNotRunningError, VMNotReadyError, ConnectionTimeoutError } from "@/cli/sessions/errors"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "vm-session" })

/**
 * Command structure for execution
 */
export interface Command {
  /** Command string to execute */
  readonly command: string
  /** Working directory for command execution */
  readonly cwd?: string
  /** Environment variables */
  readonly env?: Record<string, string>
  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * Execution result
 */
export interface Result {
  /** Exit code from command */
  readonly exitCode: number
  /** Standard output as Buffer */
  readonly stdout: Buffer
  /** Standard error as Buffer */
  readonly stderr: Buffer
}

/**
 * Session interface for command execution
 */
export interface Session {
  /**
   * Execute a command and return the result
   * @param command - Command to execute
   * @returns Execution result
   */
  execute(command: Command): Promise<Result>
}

/**
 * Configuration for VM session
 */
export interface VMSessionConfig {
  /** Path to the Unix socket */
  readonly socketPath?: string
  /** Connection timeout in milliseconds */
  readonly connectionTimeout?: number
  /** Maximum number of connections in pool */
  readonly maxConnections?: number
}

/**
 * Default socket path for Allternit Desktop daemon
 */
const DEFAULT_SOCKET_PATH = "/var/run/allternit/desktop-vm.sock"

/**
 * Default connection timeout (30 seconds)
 */
const DEFAULT_CONNECTION_TIMEOUT = 30000

/**
 * VM Session implementation that connects to Allternit Desktop daemon
 *
 * This session type provides VM-based command execution through a Unix socket
 * connection to the desktop daemon. It supports connection pooling for
 * efficient concurrent command execution.
 *
 * @example
 * ```typescript
 * const session = new VMSession()
 * if (await session.isDaemonRunning()) {
 *   const result = await session.execute({
 *     command: "ls -la",
 *     cwd: "/home/user"
 *   })
 *   console.log(result.stdout.toString())
 * }
 * ```
 */
export class VMSession implements Session {
  private readonly socketPath: string
  private readonly connectionTimeout: number
  private connectionPool: ConnectionPool

  /**
   * Create a new VM session
   * @param config - Optional configuration
   */
  constructor(config: VMSessionConfig = {}) {
    this.socketPath = config.socketPath ?? DEFAULT_SOCKET_PATH
    this.connectionTimeout = config.connectionTimeout ?? DEFAULT_CONNECTION_TIMEOUT
    this.connectionPool = new ConnectionPool({
      socketPath: this.socketPath,
      maxConnections: config.maxConnections ?? 5,
    })
  }

  /**
   * Execute a command in the VM
   *
   * @param command - Command to execute
   * @returns Execution result with exit code, stdout, and stderr
   * @throws {DaemonNotRunningError} If desktop daemon is not running
   * @throws {VMNotReadyError} If VM is not ready
   * @throws {ConnectionTimeoutError} If connection times out
   */
  async execute(command: Command): Promise<Result> {
    log.info("Executing command in VM", { command: command.command, cwd: command.cwd })

    // Check if desktop is running
    const isRunning = await this.isDaemonRunning()
    if (!isRunning) {
      log.error("Desktop daemon not running")
      throw new DaemonNotRunningError()
    }

    // Execute command through connection pool
    return this.connectionPool.withConnection(async (client) => {
      // Check VM status before executing
      const status = await client.getVMStatus()
      if (status === "starting") {
        throw new VMNotReadyError()
      }
      if (status === "stopped") {
        // Try to start the VM
        await client.startVM()
        throw new VMNotReadyError()
      }

      // Execute the command
      const result = await client.execute({
        command: command.command,
        workingDir: command.cwd,
        env: command.env,
        timeout: command.timeout,
      })

      log.info("Command executed successfully", {
        exitCode: result.exitCode,
        stdoutLength: result.stdout.length,
        stderrLength: result.stderr.length,
      })

      return {
        exitCode: result.exitCode,
        stdout: Buffer.from(result.stdout, "base64"),
        stderr: Buffer.from(result.stderr, "base64"),
      }
    })
  }

  /**
   * Execute a command with streaming output
   *
   * @param command - Command to execute
   * @param handlers - Stream handlers for stdout/stderr
   * @returns Promise that resolves when command completes
   * @throws {DaemonNotRunningError} If desktop daemon is not running
   * @throws {VMNotReadyError} If VM is not ready
   */
  async executeStreaming(
    command: Command,
    handlers: {
      onStdout: (data: Buffer) => void
      onStderr: (data: Buffer) => void
      onExit: (code: number) => void
    }
  ): Promise<void> {
    log.info("Executing streaming command in VM", { command: command.command })

    const isRunning = await this.isDaemonRunning()
    if (!isRunning) {
      throw new DaemonNotRunningError()
    }

    return this.connectionPool.withConnection(async (client) => {
      const status = await client.getVMStatus()
      if (status === "starting") {
        throw new VMNotReadyError()
      }
      if (status === "stopped") {
        await client.startVM()
        throw new VMNotReadyError()
      }

      await client.executeStreaming(
        {
          command: command.command,
          workingDir: command.cwd,
          env: command.env,
          timeout: command.timeout,
        },
        {
          onStdout: (data) => handlers.onStdout(Buffer.from(data, "base64")),
          onStderr: (data) => handlers.onStderr(Buffer.from(data, "base64")),
          onExit: handlers.onExit,
        }
      )
    })
  }

  /**
   * Check if the desktop daemon is running and accessible
   *
   * @returns True if daemon is running and socket is accessible
   */
  async isDaemonRunning(): Promise<boolean> {
    try {
      // Check if socket file exists
      await fs.access(this.socketPath)

      // Try to connect and ping
      const client = new DaemonClient(this.socketPath, this.connectionTimeout)
      try {
        await client.ping()
        return true
      } finally {
        await client.close()
      }
    } catch (error) {
      log.debug("Daemon not running or not accessible", {
        socketPath: this.socketPath,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Get the current VM status from the daemon
   *
   * @returns VM status or undefined if daemon not running
   */
  async getVMStatus(): Promise<"running" | "starting" | "stopped" | undefined> {
    try {
      await fs.access(this.socketPath)
      const client = new DaemonClient(this.socketPath, this.connectionTimeout)
      try {
        return await client.getVMStatus()
      } finally {
        await client.close()
      }
    } catch {
      return undefined
    }
  }

  /**
   * Start the VM through the daemon
   *
   * @throws {DaemonNotRunningError} If desktop daemon is not running
   */
  async startVM(): Promise<void> {
    const isRunning = await this.isDaemonRunning()
    if (!isRunning) {
      throw new DaemonNotRunningError()
    }

    return this.connectionPool.withConnection(async (client) => {
      await client.startVM()
    })
  }

  /**
   * Clean up resources and close all connections
   */
  async dispose(): Promise<void> {
    await this.connectionPool.dispose()
  }
}
