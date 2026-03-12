/**
 * Desktop Daemon Client
 *
 * Provides a client for communicating with the A2R Desktop daemon via Unix socket.
 * Implements the protocol for sending commands and receiving results from the VM.
 *
 * @module @/cli/daemon-client
 */

import net from "net"
import { EventEmitter } from "events"
import { Log } from "@/shared/util/log"
import { SocketError, ProtocolError, DaemonError } from "@/cli/sessions/errors"

const log = Log.create({ service: "daemon-client" })

/**
 * Request types sent from CLI to Desktop
 */
type RequestType = "execute" | "status" | "start_vm" | "stop_vm" | "ping"

/**
 * Response types from Desktop to CLI
 */
type ResponseType = "success" | "error"

/**
 * VM status values
 */
export type VMStatus = "running" | "starting" | "stopped"

/**
 * CLI to Desktop request structure
 */
export interface CLIToDesktopRequest {
  /** Unique request ID */
  readonly id: string
  /** Request type */
  readonly type: RequestType
  /** Request payload */
  readonly payload: unknown
}

/**
 * Desktop to CLI response structure
 */
export interface DesktopToCLIResponse {
  /** Request ID this responds to */
  readonly id: string
  /** Response type */
  readonly type: ResponseType
  /** Response payload */
  readonly payload: unknown
  /** Error details if type is "error" */
  readonly error?: {
    code: string
    message: string
  }
}

/**
 * Options for command execution
 */
export interface ExecuteOptions {
  /** Command string to execute */
  readonly command: string
  /** Working directory */
  readonly workingDir?: string
  /** Environment variables */
  readonly env?: Record<string, string>
  /** Timeout in milliseconds */
  readonly timeout?: number
}

/**
 * Result from command execution
 */
export interface ExecuteResult {
  /** Exit code */
  readonly exitCode: number
  /** Base64-encoded stdout */
  readonly stdout: string
  /** Base64-encoded stderr */
  readonly stderr: string
}

/**
 * Handlers for streaming output
 */
export interface StreamHandlers {
  /** Called when stdout data is received */
  readonly onStdout: (data: string) => void
  /** Called when stderr data is received */
  readonly onStderr: (data: string) => void
  /** Called when command exits */
  readonly onExit: (code: number) => void
}

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * Protocol client for message framing
 *
 * Handles message serialization/deserialization with length-prefixed framing
 * to handle multiple messages over the same socket connection.
 */
class ProtocolClient extends EventEmitter {
  private buffer: Buffer = Buffer.alloc(0)
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private requestId = 0
  private streamingHandlers: Map<string, StreamHandlers> = new Map()

  constructor(private socket: net.Socket) {
    super()
    this.socket.on("data", (data) => this.handleData(data))
    this.socket.on("error", (error) => this.handleError(error))
    this.socket.on("close", () => this.handleClose())
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest(type: RequestType, payload: unknown, timeout: number): Promise<unknown> {
    const id = this.generateId()
    const request: CLIToDesktopRequest = { id, type, payload }

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new ProtocolError(`Request ${type} timed out after ${timeout}ms`, "TIMEOUT"))
      }, timeout)

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutTimer })

      // Send request with length prefix
      const data = JSON.stringify(request)
      const lengthBuffer = Buffer.alloc(4)
      lengthBuffer.writeUInt32BE(data.length, 0)

      log.debug("Sending request", { id, type })
      this.socket.write(lengthBuffer)
      this.socket.write(data)
    })
  }

  /**
   * Send a streaming request with handlers
   */
  async sendStreamingRequest(
    type: RequestType,
    payload: unknown,
    handlers: StreamHandlers,
    timeout: number
  ): Promise<void> {
    const id = this.generateId()
    const request: CLIToDesktopRequest = { id, type, payload }

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(id)
        this.streamingHandlers.delete(id)
        reject(new ProtocolError(`Streaming request ${type} timed out after ${timeout}ms`, "TIMEOUT"))
      }, timeout)

      // For streaming, we track the request but handle responses differently
      const pendingHandler: PendingRequest = {
        resolve: () => {
          clearTimeout(timeoutTimer)
          this.streamingHandlers.delete(id)
          resolve()
        },
        reject: (error) => {
          clearTimeout(timeoutTimer)
          this.streamingHandlers.delete(id)
          reject(error)
        },
        timeout: timeoutTimer,
      }

      this.pendingRequests.set(id, pendingHandler)
      this.streamingHandlers.set(id, handlers)

      // Send request
      const data = JSON.stringify(request)
      const lengthBuffer = Buffer.alloc(4)
      lengthBuffer.writeUInt32BE(data.length, 0)

      log.debug("Sending streaming request", { id, type })
      this.socket.write(lengthBuffer)
      this.socket.write(data)
    })
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req_${++this.requestId}_${Date.now()}`
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])

    // Process complete messages
    while (this.buffer.length >= 4) {
      const messageLength = this.buffer.readUInt32BE(0)

      // Wait for complete message
      if (this.buffer.length < 4 + messageLength) {
        break
      }

      // Extract message
      const messageData = this.buffer.subarray(4, 4 + messageLength)
      this.buffer = this.buffer.subarray(4 + messageLength)

      try {
        const response: DesktopToCLIResponse = JSON.parse(messageData.toString())
        this.handleResponse(response)
      } catch (error) {
        log.error("Failed to parse response", {
          error: error instanceof Error ? error.message : String(error),
          data: messageData.toString().slice(0, 200),
        })
      }
    }
  }

  /**
   * Handle parsed response
   */
  private handleResponse(response: DesktopToCLIResponse): void {
    log.debug("Received response", { id: response.id, type: response.type })

    // Check if this is a streaming response
    if (this.streamingHandlers.has(response.id)) {
      this.handleStreamingResponse(response)
      return
    }

    // Regular response
    const pending = this.pendingRequests.get(response.id)
    if (!pending) {
      log.warn("Received response for unknown request", { id: response.id })
      return
    }

    // Clear timeout
    clearTimeout(pending.timeout)
    this.pendingRequests.delete(response.id)

    // Resolve or reject based on response type
    if (response.type === "error") {
      pending.reject(
        new DaemonError(
          response.error?.code ?? "UNKNOWN",
          response.error?.message ?? "Unknown error"
        )
      )
    } else {
      pending.resolve(response.payload)
    }
  }

  /**
   * Handle streaming response
   */
  private handleStreamingResponse(response: DesktopToCLIResponse): void {
    const handler = this.streamingHandlers.get(response.id)
    if (!handler) return

    const payload = response.payload as {
      stdout?: string
      stderr?: string
      exitCode?: number
      done?: boolean
    }

    if (payload.stdout !== undefined) {
      handler.onStdout(payload.stdout)
    }
    if (payload.stderr !== undefined) {
      handler.onStderr(payload.stderr)
    }
    if (payload.exitCode !== undefined) {
      handler.onExit(payload.exitCode)
    }
    if (payload.done) {
      const pending = this.pendingRequests.get(response.id)
      if (pending) {
        clearTimeout(pending.timeout)
        pending.resolve(undefined)
        this.pendingRequests.delete(response.id)
      }
      this.streamingHandlers.delete(response.id)
    }
  }

  /**
   * Handle socket error
   */
  private handleError(error: Error): void {
    log.error("Socket error", { error: error.message })
    this.emit("error", error)

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new SocketError("Socket error", error))
    }
    this.pendingRequests.clear()
    this.streamingHandlers.clear()
  }

  /**
   * Handle socket close
   */
  private handleClose(): void {
    log.debug("Socket closed")
    this.emit("close")

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new SocketError("Socket closed"))
    }
    this.pendingRequests.clear()
    this.streamingHandlers.clear()
  }

  /**
   * Close the protocol client
   */
  close(): void {
    // Reject any remaining pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new SocketError("Protocol client closed"))
    }
    this.pendingRequests.clear()
    this.streamingHandlers.clear()
    this.removeAllListeners()
  }
}

/**
 * Client for communicating with the A2R Desktop daemon
 *
 * Provides methods for executing commands, querying status, and managing
 * the VM through a Unix socket connection.
 *
 * @example
 * ```typescript
 * const client = new DaemonClient("/var/run/a2r/desktop-vm.sock")
 * try {
 *   const result = await client.execute({
 *     command: "ls -la",
 *     workingDir: "/home/user"
 *   })
 *   console.log(result.stdout)
 * } finally {
 *   await client.close()
 * }
 * ```
 */
export class DaemonClient {
  private socket: net.Socket
  private protocol: ProtocolClient
  private connected: boolean = false
  private readonly defaultTimeout: number

  /**
   * Create a new daemon client
   *
   * @param socketPath - Path to Unix socket
   * @param timeout - Default timeout for operations in milliseconds
   */
  constructor(socketPath: string, timeout: number = 30000) {
    this.defaultTimeout = timeout
    this.socket = net.createConnection(socketPath)
    this.protocol = new ProtocolClient(this.socket)

    // Wait for connection
    this.socket.on("connect", () => {
      this.connected = true
      log.debug("Connected to daemon")
    })

    this.socket.on("error", (error) => {
      log.error("Socket connection error", { error: error.message })
      this.connected = false
    })

    this.socket.on("close", () => {
      this.connected = false
    })
  }

  /**
   * Wait for socket to be connected
   */
  private async waitForConnection(timeout: number): Promise<void> {
    if (this.connected) return

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SocketError(`Connection timeout after ${timeout}ms`))
      }, timeout)

      this.socket.once("connect", () => {
        clearTimeout(timer)
        resolve()
      })

      this.socket.once("error", (error) => {
        clearTimeout(timer)
        reject(new SocketError("Failed to connect", error))
      })
    })
  }

  /**
   * Ping the daemon to check if it's alive
   *
   * @returns True if daemon responds to ping
   */
  async ping(): Promise<boolean> {
    try {
      await this.waitForConnection(this.defaultTimeout)
      await this.protocol.sendRequest("ping", {}, 5000)
      return true
    } catch (error) {
      log.debug("Ping failed", { error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * Execute a command in the VM
   *
   * @param options - Execution options
   * @returns Execution result
   * @throws {SocketError} If socket communication fails
   * @throws {DaemonError} If daemon returns an error
   */
  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    await this.waitForConnection(this.defaultTimeout)

    const timeout = options.timeout ?? this.defaultTimeout
    const result = await this.protocol.sendRequest(
      "execute",
      {
        command: options.command,
        workingDir: options.workingDir,
        env: options.env,
        timeout: timeout,
      },
      timeout + 5000 // Add buffer for daemon processing
    )

    return result as ExecuteResult
  }

  /**
   * Execute a command with streaming output
   *
   * @param options - Execution options
   * @param handlers - Stream handlers for real-time output
   */
  async executeStreaming(options: ExecuteOptions, handlers: StreamHandlers): Promise<void> {
    await this.waitForConnection(this.defaultTimeout)

    const timeout = options.timeout ?? this.defaultTimeout
    await this.protocol.sendStreamingRequest(
      "execute",
      {
        command: options.command,
        workingDir: options.workingDir,
        env: options.env,
        timeout: timeout,
        streaming: true,
      },
      handlers,
      timeout + 5000
    )
  }

  /**
   * Get the current VM status
   *
   * @returns VM status
   * @throws {SocketError} If socket communication fails
   */
  async getVMStatus(): Promise<VMStatus> {
    await this.waitForConnection(this.defaultTimeout)

    const result = await this.protocol.sendRequest("status", {}, 5000)
    return (result as { status: VMStatus }).status
  }

  /**
   * Start the VM
   *
   * @throws {SocketError} If socket communication fails
   * @throws {DaemonError} If daemon returns an error
   */
  async startVM(): Promise<void> {
    await this.waitForConnection(this.defaultTimeout)
    await this.protocol.sendRequest("start_vm", {}, 60000)
  }

  /**
   * Stop the VM
   *
   * @throws {SocketError} If socket communication fails
   * @throws {DaemonError} If daemon returns an error
   */
  async stopVM(): Promise<void> {
    await this.waitForConnection(this.defaultTimeout)
    await this.protocol.sendRequest("stop_vm", {}, 30000)
  }

  /**
   * Close the connection to the daemon
   */
  async close(): Promise<void> {
    this.protocol.close()

    if (!this.socket.destroyed) {
      this.socket.end()
      // Wait for socket to close gracefully
      await new Promise<void>((resolve) => {
        if (this.socket.destroyed) {
          resolve()
          return
        }
        this.socket.once("close", () => resolve())
        // Force close after timeout
        setTimeout(() => {
          this.socket.destroy()
          resolve()
        }, 1000)
      })
    }

    this.connected = false
  }
}
