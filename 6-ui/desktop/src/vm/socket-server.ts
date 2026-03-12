/**
 * Unix Socket Server for CLI Communication
 *
 * Provides a Unix domain socket server that accepts connections
 * from the CLI and forwards commands to the VM.
 *
 * @module socket-server
 * @example
 * ```typescript
 * const server = new SocketServer(vmManager);
 * await server.start('/var/run/a2r/desktop-vm.sock');
 *
 * // CLI connects and sends commands
 * // Responses are returned via the socket
 * ```
 */

import { EventEmitter } from "events";
import * as net from "net";
import * as fs from "fs/promises";
import * as path from "path";
import { DesktopVMManager } from "./manager.js";

/**
 * Socket server configuration options
 */
export interface SocketServerOptions {
  /** Maximum concurrent connections (default: 10) */
  maxConnections?: number;
  /** Connection timeout in milliseconds (default: 30000) */
  connectionTimeout?: number;
  /** Read timeout in milliseconds (default: 5000) */
  readTimeout?: number;
  /** Buffer size for socket reads (default: 65536) */
  bufferSize?: number;
  /** Socket file permissions (default: 0o666) */
  socketPermissions?: number;
  /** Whether to remove existing socket file (default: true) */
  removeExisting?: boolean;
}

/**
 * Socket connection information
 */
export interface SocketConnection {
  /** Connection ID */
  id: string;
  /** Client process ID (if available) */
  pid?: number;
  /** Client user ID */
  uid?: number;
  /** Connection start time */
  connectedAt: Date;
  /** Bytes received */
  bytesReceived: number;
  /** Bytes sent */
  bytesSent: number;
  /** Number of commands processed */
  commandsProcessed: number;
}

/**
 * Command request from CLI
 */
interface CLICommandRequest {
  /** Request ID */
  id: string;
  /** Command to execute */
  command: string;
  /** Working directory */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to stream output */
  stream?: boolean;
}

/**
 * Command response to CLI
 */
interface CLICommandResponse {
  /** Request ID */
  id: string;
  /** Success flag */
  success: boolean;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Exit code */
  exitCode?: number;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
}

/**
 * Server status
 */
export interface SocketServerStatus {
  /** Whether server is listening */
  listening: boolean;
  /** Socket path */
  socketPath?: string;
  /** Number of active connections */
  activeConnections: number;
  /** Total connections served */
  totalConnections: number;
  /** Server start time */
  startedAt?: Date;
}

/**
 * Socket server events
 */
export interface SocketServerEvents {
  "server:started": (path: string) => void;
  "server:stopped": () => void;
  "server:error": (error: Error) => void;
  "connection:open": (conn: SocketConnection) => void;
  "connection:close": (conn: SocketConnection) => void;
  "connection:error": (conn: SocketConnection, error: Error) => void;
  "command:received": (conn: SocketConnection, request: CLICommandRequest) => void;
  "command:completed": (
    conn: SocketConnection,
    request: CLICommandRequest,
    response: CLICommandResponse
  ) => void;
  "command:error": (
    conn: SocketConnection,
    request: CLICommandRequest,
    error: Error
  ) => void;
}

/**
 * Socket server error
 */
export class SocketServerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SocketServerError";
    Object.setPrototypeOf(this, SocketServerError.prototype);
  }
}

/**
 * Unix Socket Server
 *
 * Listens on a Unix domain socket for CLI connections.
 * Forwards commands to the VM and returns results.
 */
export class SocketServer extends EventEmitter {
  private server: net.Server | null = null;
  private options: Required<SocketServerOptions>;
  private connections = new Map<string, net.Socket>();
  private connectionInfo = new Map<string, SocketConnection>();
  private socketPath: string | null = null;
  private isListening = false;
  private totalConnections = 0;
  private startedAt?: Date;

  constructor(
    private vmManager: DesktopVMManager,
    options: SocketServerOptions = {}
  ) {
    super();

    this.options = {
      maxConnections: options.maxConnections ?? 10,
      connectionTimeout: options.connectionTimeout ?? 30000,
      readTimeout: options.readTimeout ?? 5000,
      bufferSize: options.bufferSize ?? 65536,
      socketPermissions: options.socketPermissions ?? 0o666,
      removeExisting: options.removeExisting ?? true,
    };
  }

  /**
   * Start the socket server
   * @param socketPath - Path for the Unix socket
   * @throws {SocketServerError} If server fails to start
   */
  async start(socketPath: string): Promise<void> {
    if (this.isListening) {
      throw new SocketServerError("Server already running", "ALREADY_RUNNING");
    }

    this.socketPath = socketPath;

    // Ensure directory exists
    const dir = path.dirname(socketPath);
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    } catch (error) {
      throw new SocketServerError(
        `Failed to create socket directory: ${error}`,
        "DIRECTORY_CREATE_FAILED",
        error as Error
      );
    }

    // Remove existing socket file if requested
    if (this.options.removeExisting) {
      try {
        await fs.unlink(socketPath);
      } catch {
        // Ignore if doesn't exist
      }
    }

    // Create server
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    // Handle server errors
    this.server.on("error", (error) => {
      this.emit("server:error", error);
    });

    // Start listening
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new SocketServerError("Server not created", "NOT_CREATED"));
        return;
      }

      const onError = (error: Error) => {
        this.server?.off("error", onError);
        reject(
          new SocketServerError(
            `Failed to start server: ${error.message}`,
            "START_FAILED",
            error
          )
        );
      };

      this.server.once("error", onError);

      this.server.listen(socketPath, async () => {
        this.server?.off("error", onError);

        try {
          // Set socket permissions
          await fs.chmod(socketPath, this.options.socketPermissions);

          this.isListening = true;
          this.startedAt = new Date();
          this.emit("server:started", socketPath);

          resolve();
        } catch (error) {
          reject(
            new SocketServerError(
              `Failed to set socket permissions: ${error}`,
              "PERMISSION_FAILED",
              error as Error
            )
          );
        }
      });
    });
  }

  /**
   * Stop the socket server
   */
  async stop(): Promise<void> {
    if (!this.isListening || !this.server) {
      return;
    }

    // Close all connections
    for (const [id, socket] of this.connections) {
      socket.end();
      socket.destroy();
      this.connections.delete(id);
      this.connectionInfo.delete(id);
    }

    // Close server
    return new Promise((resolve) => {
      this.server?.close(() => {
        this.isListening = false;
        this.emit("server:stopped");
        resolve();
      });

      // Force close after timeout
      setTimeout(() => {
        if (this.isListening) {
          this.server?.emit("close");
        }
      }, 5000);
    });
  }

  /**
   * Get server status
   */
  getStatus(): SocketServerStatus {
    return {
      listening: this.isListening,
      socketPath: this.socketPath ?? undefined,
      activeConnections: this.connections.size,
      totalConnections: this.totalConnections,
      startedAt: this.startedAt,
    };
  }

  /**
   * Get active connections
   */
  getConnections(): SocketConnection[] {
    return Array.from(this.connectionInfo.values());
  }

  /**
   * Check if server is listening
   */
  get listening(): boolean {
    return this.isListening;
  }

  /**
   * Handle a new connection
   * @param socket - Incoming socket
   */
  private handleConnection(socket: net.Socket): void {
    // Check max connections
    if (this.connections.size >= this.options.maxConnections) {
      socket.end(
        JSON.stringify({
          error: "Server at capacity",
          code: "MAX_CONNECTIONS",
        }) + "\n"
      );
      socket.destroy();
      return;
    }

    // Generate connection ID
    const connId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create connection info
    const connInfo: SocketConnection = {
      id: connId,
      pid: (socket as any).pid,
      uid: (socket as any).uid,
      connectedAt: new Date(),
      bytesReceived: 0,
      bytesSent: 0,
      commandsProcessed: 0,
    };

    this.connections.set(connId, socket);
    this.connectionInfo.set(connId, connInfo);
    this.totalConnections++;

    this.emit("connection:open", connInfo);

    // Set up socket handlers
    let buffer = "";

    socket.setTimeout(this.options.connectionTimeout);
    socket.setNoDelay(true);

    socket.on("data", (data) => {
      connInfo.bytesReceived += data.length;
      buffer += data.toString("utf-8");

      // Process complete messages (newline-delimited)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const message = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (message) {
          this.handleMessage(socket, connInfo, message);
        }
      }

      // Prevent buffer overflow
      if (buffer.length > this.options.bufferSize) {
        this.sendError(socket, "", "Message too large", "MESSAGE_TOO_LARGE");
        buffer = "";
      }
    });

    socket.on("timeout", () => {
      this.sendError(socket, "", "Connection timeout", "TIMEOUT");
      socket.end();
    });

    socket.on("error", (error) => {
      this.emit("connection:error", connInfo, error);
    });

    socket.on("close", () => {
      this.connections.delete(connId);
      this.connectionInfo.delete(connId);
      this.emit("connection:close", connInfo);
    });

    // Send ready message
    this.sendResponse(socket, {
      id: "ready",
      success: true,
      stdout: "Connected to A2R Desktop VM",
    });
  }

  /**
   * Handle a message from a client
   * @param socket - Client socket
   * @param connInfo - Connection information
   * @param message - Message string
   */
  private async handleMessage(
    socket: net.Socket,
    connInfo: SocketConnection,
    message: string
  ): Promise<void> {
    let request: CLICommandRequest;

    try {
      request = JSON.parse(message);
    } catch {
      this.sendError(socket, "", "Invalid JSON", "INVALID_JSON");
      return;
    }

    // Validate request
    if (!request.id || !request.command) {
      this.sendError(socket, request?.id || "", "Missing id or command", "INVALID_REQUEST");
      return;
    }

    this.emit("command:received", connInfo, request);

    const startTime = Date.now();

    try {
      // Execute command on VM
      const result = await this.vmManager.execute(request.command, {
        workingDir: request.workingDir,
        env: request.env,
        timeout: request.timeout,
      });

      const executionTimeMs = Date.now() - startTime;

      const response: CLICommandResponse = {
        id: request.id,
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs,
      };

      connInfo.commandsProcessed++;
      connInfo.bytesSent += JSON.stringify(response).length;

      this.sendResponse(socket, response);
      this.emit("command:completed", connInfo, request, response);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const response: CLICommandResponse = {
        id: request.id,
        success: false,
        error: errorMessage,
        executionTimeMs,
      };

      this.sendResponse(socket, response);
      this.emit("command:error", connInfo, request, error as Error);
    }
  }

  /**
   * Send a response to a client
   * @param socket - Client socket
   * @param response - Response object
   */
  private sendResponse(socket: net.Socket, response: CLICommandResponse): void {
    try {
      socket.write(JSON.stringify(response) + "\n");
    } catch (error) {
      // Socket may be closed
    }
  }

  /**
   * Send an error response
   * @param socket - Client socket
   * @param id - Request ID
   * @param message - Error message
   * @param code - Error code
   */
  private sendError(
    socket: net.Socket,
    id: string,
    message: string,
    code: string
  ): void {
    this.sendResponse(socket, {
      id,
      success: false,
      error: message,
      exitCode: -1,
    });
  }

  /**
   * Broadcast a message to all connected clients
   * @param message - Message to broadcast
   */
  broadcast(message: string): void {
    const data = JSON.stringify({ type: "broadcast", message }) + "\n";

    for (const socket of this.connections.values()) {
      try {
        socket.write(data);
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Dispose of the server
   */
  async dispose(): Promise<void> {
    await this.stop();

    // Clean up socket file
    if (this.socketPath) {
      try {
        await fs.unlink(this.socketPath);
      } catch {
        // Ignore errors
      }
    }

    this.connections.clear();
    this.connectionInfo.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a new socket server
 * @param vmManager - VM manager instance
 * @param options - Server options
 * @returns New SocketServer instance
 */
export function createSocketServer(
  vmManager: DesktopVMManager,
  options?: SocketServerOptions
): SocketServer {
  return new SocketServer(vmManager, options);
}

export default SocketServer;
