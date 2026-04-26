/**
 * @fileoverview Allternit Guest Agent Protocol - Server Implementation
 * 
 * Protocol server for handling requests from the host.
 * Runs inside the VM and executes commands, reads/writes files.
 * 
 * @module server.js
 */

import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";
import type {
  ExecuteRequest,
  ExecuteResponse,
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  ErrorResponse,
  ProtocolMessage,
  StreamChunk,
  StreamEnd,
} from "./types.js";
import {
  isExecuteRequest,
  isFileReadRequest,
  isFileWriteRequest,
} from "./types.js";
import { encodeMessage, decodeMessage } from "./codec.js";
import { readFrame, writeFrame, FramingError } from "./framing.js";

/** Error codes for server operations */
export enum ServerErrorCode {
  UNKNOWN_MESSAGE_TYPE = "UNKNOWN_MESSAGE_TYPE",
  INVALID_REQUEST = "INVALID_REQUEST",
  HANDLER_ERROR = "HANDLER_ERROR",
  CONNECTION_ERROR = "CONNECTION_ERROR",
  NOT_RUNNING = "NOT_RUNNING",
}

/**
 * Error thrown by the protocol server
 */
export class ProtocolServerError extends Error {
  constructor(
    public readonly code: ServerErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ProtocolServerError";
    Error.captureStackTrace?.(this, ProtocolServerError);
  }
}

/**
 * Request handlers interface
 */
export interface RequestHandlers {
  /**
   * Execute a command
   * @param request - Execute request
   * @returns Execute response with output and exit code
   */
  execute(request: ExecuteRequest): Promise<ExecuteResponse>;

  /**
   * Read a file
   * @param request - File read request
   * @returns File read response with content
   */
  fileRead(request: FileReadRequest): Promise<FileReadResponse>;

  /**
   * Write a file
   * @param request - File write request
   */
  fileWrite(request: FileWriteRequest): Promise<void>;
}

/**
 * VM Connection interface
 */
export interface VMConnection {
  /** Readable stream for receiving data */
  readable: Readable;
  /** Writable stream for sending data */
  writable: Writable;
  /** Close the connection */
  close(): void;
  /** Check if connection is closed */
  closed: boolean;
}

/**
 * Server options
 */
export interface ProtocolServerOptions {
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Protocol server for handling guest agent requests
 */
export class ProtocolServer extends EventEmitter {
  private isRunning = false;
  private isShuttingDown = false;
  private activeRequests = new Set<string>();

  /**
   * Create a new protocol server
   * @param connection - VM connection with readable/writable streams
   * @param handlers - Request handlers for execute, fileRead, fileWrite
   * @param options - Server options
   */
  constructor(
    private connection: VMConnection,
    private handlers: RequestHandlers,
    private options: ProtocolServerOptions = {}
  ) {
    super();
  }

  /**
   * Log debug message if debug mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug) {
      console.log(`[ProtocolServer] ${message}`, ...args);
    }
  }

  /**
   * Start the server and begin processing requests
   * @throws {ProtocolServerError} If already running or connection is closed
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new ProtocolServerError(
        ServerErrorCode.NOT_RUNNING,
        "Server is already running"
      );
    }

    if (this.connection.closed) {
      throw new ProtocolServerError(
        ServerErrorCode.CONNECTION_ERROR,
        "Connection is closed"
      );
    }

    this.isRunning = true;
    this.isShuttingDown = false;
    this.emit("start");

    this.log("Server started");

    // Start the read loop
    this.runLoop().catch((err) => {
      this.emit("error", err);
    });
  }

  /**
   * Main server loop - reads and processes messages
   */
  private async runLoop(): Promise<void> {
    while (this.isRunning && !this.connection.closed) {
      try {
        const payload = await readFrame(this.connection.readable);
        const message = decodeMessage(payload);
        this.handleMessage(message);
      } catch (err) {
        if (!this.isRunning || this.connection.closed) {
          break;
        }

        if (err instanceof FramingError) {
          this.emit("error", err);
          this.log("Framing error:", err.message);
        } else if (err instanceof Error) {
          if (err.message.includes("closed") || err.message.includes("end")) {
            this.log("Connection closed");
            break;
          }
          this.emit("error", err);
          this.log("Error:", err.message);
        }
      }
    }

    // Connection ended or server stopped
    this.log("Server loop ended");
    await this.stop();
  }

  /**
   * Handle an incoming message
   */
  private async handleMessage(message: ProtocolMessage): Promise<void> {
    this.log("Received message:", message.type, message.id);

    if (this.isShuttingDown) {
      await this.sendError(
        message.id,
        "SERVER_SHUTTING_DOWN",
        "Server is shutting down"
      );
      return;
    }

    // Track active request
    this.activeRequests.add(message.id);

    try {
      if (isExecuteRequest(message)) {
        await this.handleExecute(message);
      } else if (isFileReadRequest(message)) {
        await this.handleFileRead(message);
      } else if (isFileWriteRequest(message)) {
        await this.handleFileWrite(message);
      } else {
        await this.sendError(
          message.id,
          ServerErrorCode.UNKNOWN_MESSAGE_TYPE,
          `Unknown message type: ${(message as ProtocolMessage).type}`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      await this.sendError(
        message.id,
        ServerErrorCode.HANDLER_ERROR,
        error.message
      );
    } finally {
      this.activeRequests.delete(message.id);
    }
  }

  /**
   * Handle execute request
   */
  private async handleExecute(request: ExecuteRequest): Promise<void> {
    try {
      const response = await this.handlers.execute(request);
      await this.sendMessage(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log("Execute error:", error.message);
      await this.sendError(
        request.id,
        "EXECUTE_ERROR",
        error.message
      );
    }
  }

  /**
   * Handle file read request
   */
  private async handleFileRead(request: FileReadRequest): Promise<void> {
    try {
      const response = await this.handlers.fileRead(request);
      await this.sendMessage(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log("File read error:", error.message);
      await this.sendError(
        request.id,
        "FILE_READ_ERROR",
        error.message
      );
    }
  }

  /**
   * Handle file write request
   */
  private async handleFileWrite(request: FileWriteRequest): Promise<void> {
    try {
      await this.handlers.fileWrite(request);
      // File write returns no specific response (void)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log("File write error:", error.message);
      await this.sendError(
        request.id,
        "FILE_WRITE_ERROR",
        error.message
      );
    }
  }

  /**
   * Send a message to the client
   */
  private async sendMessage(message: ProtocolMessage): Promise<void> {
    const frame = encodeMessage(message);
    await writeFrame(this.connection.writable, frame.subarray(4));
  }

  /**
   * Send an error response
   */
  private async sendError(
    requestId: string,
    code: string,
    message: string
  ): Promise<void> {
    const errorResponse: ErrorResponse = {
      id: requestId,
      type: "error",
      code,
      message,
    };
    await this.sendMessage(errorResponse);
  }

  /**
   * Stream a chunk of output to the client
   * @param requestId - Original request ID
   * @param stream - Which stream (stdout or stderr)
   * @param data - Chunk data
   */
  async streamChunk(
    requestId: string,
    stream: "stdout" | "stderr",
    data: Buffer
  ): Promise<void> {
    if (this.connection.closed) {
      throw new ProtocolServerError(
        ServerErrorCode.CONNECTION_ERROR,
        "Connection is closed"
      );
    }

    const chunk: StreamChunk = {
      id: requestId,
      type: "stream_chunk",
      stream,
      data: data.toString("base64"),
    };

    await this.sendMessage(chunk);
  }

  /**
   * Signal end of streaming
   * @param requestId - Original request ID
   * @param exitCode - Process exit code
   */
  async streamEnd(requestId: string, exitCode: number): Promise<void> {
    if (this.connection.closed) {
      throw new ProtocolServerError(
        ServerErrorCode.CONNECTION_ERROR,
        "Connection is closed"
      );
    }

    const end: StreamEnd = {
      id: requestId,
      type: "stream_end",
      exitCode,
    };

    await this.sendMessage(end);
  }

  /**
   * Check if the server is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the number of active requests
   */
  get activeRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Stop the server gracefully
   * Waits for active requests to complete before closing
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.log("Stopping server...");
    this.isShuttingDown = true;

    // Wait for active requests to complete (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0) {
      if (Date.now() - startTime > maxWaitTime) {
        this.log(
          `Timeout waiting for ${this.activeRequests.size} active requests`
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isRunning = false;
    this.isShuttingDown = false;
    this.activeRequests.clear();

    // Close connection
    this.connection.close();

    this.log("Server stopped");
    this.emit("stop");
  }

  /**
   * Force stop the server immediately
   */
  forceStop(): void {
    this.log("Force stopping server...");
    this.isRunning = false;
    this.isShuttingDown = false;
    this.activeRequests.clear();
    this.connection.close();
    this.emit("stop");
  }
}

/**
 * Create a protocol server with default handlers
 * Useful for testing or simple implementations
 */
export function createServer(
  connection: VMConnection,
  handlers: Partial<RequestHandlers>,
  options?: ProtocolServerOptions
): ProtocolServer {
  const defaultHandlers: RequestHandlers = {
    async execute(request): Promise<ExecuteResponse> {
      throw new Error("Execute handler not implemented");
    },
    async fileRead(request): Promise<FileReadResponse> {
      throw new Error("File read handler not implemented");
    },
    async fileWrite(request): Promise<void> {
      throw new Error("File write handler not implemented");
    },
  };

  return new ProtocolServer(
    connection,
    { ...defaultHandlers, ...handlers },
    options
  );
}
