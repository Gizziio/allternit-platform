/**
 * @fileoverview Allternit Guest Agent Protocol - Client Implementation
 * 
 * Protocol client for making requests to the VM guest agent.
 * Handles request/response correlation, timeouts, and streaming.
 * 
 * @module client.js
 */

import { EventEmitter } from "node:events";
import type { Readable, Writable } from "node:stream";
import { randomUUID } from "node:crypto";
import type {
  ExecuteRequest,
  ExecuteResponse,
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  ProtocolMessage,
  StreamChunk,
  StreamEnd,
} from "./types.js";
import { isErrorResponse, isExecuteResponse, isFileReadResponse, isStreamChunk, isStreamEnd } from "./types.js";
import { encodeMessage, decodeMessage, CodecError, CodecErrorCode } from "./codec.js";
import { readFrame, writeFrame, FramingError } from "./framing.js";

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT = 30000;

/** Maximum number of concurrent requests */
export const MAX_CONCURRENT_REQUESTS = 100;

/** Error codes for client operations */
export enum ClientErrorCode {
  TIMEOUT = "TIMEOUT",
  CONNECTION_CLOSED = "CONNECTION_CLOSED",
  REQUEST_FAILED = "REQUEST_FAILED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  STREAMING_ERROR = "STREAMING_ERROR",
  CANCELLED = "CANCELLED",
}

/**
 * Error thrown by the protocol client
 */
export class ProtocolClientError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string,
    public readonly requestId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ProtocolClientError";
    Error.captureStackTrace?.(this, ProtocolClientError);
  }
}

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (value: ProtocolMessage) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  streaming?: boolean;
}

/**
 * Stream handlers for streaming execution
 */
export interface StreamHandlers {
  /** Called for each stdout chunk */
  onStdout?: (data: Buffer) => void;
  /** Called for each stderr chunk */
  onStderr?: (data: Buffer) => void;
  /** Called when process exits */
  onExit?: (exitCode: number) => void;
  /** Called on error */
  onError?: (error: Error) => void;
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
 * Protocol client for communicating with the VM guest agent
 */
export class ProtocolClient extends EventEmitter {
  private pendingRequests = new Map<string, PendingRequest>();
  private isClosed = false;
  private reading = false;

  /**
   * Create a new protocol client
   * @param connection - VM connection with readable/writable streams
   */
  constructor(private connection: VMConnection) {
    super();
    this.startReading();
  }

  /**
   * Start the background reader loop
   */
  private startReading(): void {
    if (this.reading || this.isClosed) return;
    this.reading = true;

    const readLoop = async () => {
      while (!this.isClosed && !this.connection.closed) {
        try {
          const payload = await readFrame(this.connection.readable);
          const message = decodeMessage(payload);
          this.handleMessage(message);
        } catch (err) {
          if (this.isClosed) return;

          if (err instanceof FramingError || err instanceof CodecError) {
            this.emit("error", err);
          } else if (err instanceof Error) {
            if (err.message.includes("closed") || err.message.includes("end")) {
              this.close();
              return;
            }
            this.emit("error", err);
          }
        }
      }
    };

    readLoop().catch(() => {
      this.close();
    });
  }

  /**
   * Handle an incoming message
   */
  private handleMessage(message: ProtocolMessage): void {
    const pending = this.pendingRequests.get(message.id);

    if (!pending) {
      // No pending request for this message ID
      this.emit("unexpectedMessage", message);
      return;
    }

    // Handle streaming messages differently
    if (pending.streaming) {
      this.handleStreamingMessage(message, pending);
      return;
    }

    // Regular request/response
    if (isErrorResponse(message)) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.id);
      pending.reject(
        new ProtocolClientError(
          ClientErrorCode.REQUEST_FAILED,
          `${message.code}: ${message.message}`,
          message.id
        )
      );
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.id);
    pending.resolve(message);
  }

  /**
   * Handle streaming messages
   */
  private handleStreamingMessage(
    message: ProtocolMessage,
    pending: PendingRequest
  ): void {
    const handlers = pending as unknown as { handlers: StreamHandlers };

    if (isStreamChunk(message)) {
      const data = Buffer.from(message.data, "base64");
      if (message.stream === "stdout" && handlers.handlers.onStdout) {
        handlers.handlers.onStdout(data);
      } else if (message.stream === "stderr" && handlers.handlers.onStderr) {
        handlers.handlers.onStderr(data);
      }
    } else if (isStreamEnd(message)) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.id);
      if (handlers.handlers.onExit) {
        handlers.handlers.onExit(message.exitCode);
      }
    } else if (isErrorResponse(message)) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(message.id);
      if (handlers.handlers.onError) {
        handlers.handlers.onError(
          new Error(`${message.code}: ${message.message}`)
        );
      }
    }
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(
    request: ProtocolMessage,
    timeout: number,
    streaming = false,
    handlers?: StreamHandlers
  ): Promise<ProtocolMessage> {
    if (this.isClosed) {
      throw new ProtocolClientError(
        ClientErrorCode.CONNECTION_CLOSED,
        "Client is closed",
        request.id
      );
    }

    if (this.connection.closed) {
      throw new ProtocolClientError(
        ClientErrorCode.CONNECTION_CLOSED,
        "Connection is closed",
        request.id
      );
    }

    if (this.pendingRequests.size >= MAX_CONCURRENT_REQUESTS) {
      throw new ProtocolClientError(
        ClientErrorCode.TOO_MANY_REQUESTS,
        `Maximum concurrent requests (${MAX_CONCURRENT_REQUESTS}) exceeded`,
        request.id
      );
    }

    if (this.pendingRequests.has(request.id)) {
      throw new ProtocolClientError(
        ClientErrorCode.REQUEST_FAILED,
        `Request ID ${request.id} already in use`,
        request.id
      );
    }

    const frame = encodeMessage(request);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(
          new ProtocolClientError(
            ClientErrorCode.TIMEOUT,
            `Request timed out after ${timeout}ms`,
            request.id
          )
        );
      }, timeout);

      const pending: PendingRequest = {
        resolve,
        reject,
        timer,
        streaming,
      };

      if (streaming && handlers) {
        Object.assign(pending, { handlers });
      }

      this.pendingRequests.set(request.id, pending);

      // Write frame (skip length prefix since writeFrame adds it)
      writeFrame(this.connection.writable, frame.subarray(4)).catch((err) => {
        clearTimeout(timer);
        this.pendingRequests.delete(request.id);
        reject(
          new ProtocolClientError(
            ClientErrorCode.REQUEST_FAILED,
            `Failed to send request: ${err.message}`,
            request.id,
            err
          )
        );
      });
    });
  }

  /**
   * Execute a command in the VM
   * @param request - Execute request (id will be generated if not provided)
   * @returns Promise resolving to execute response
   * @throws {ProtocolClientError} On timeout, connection error, or execution failure
   */
  async execute(request: Omit<ExecuteRequest, "id" | "type">): Promise<ExecuteResponse> {
    const fullRequest: ExecuteRequest = {
      id: randomUUID(),
      type: "execute",
      ...request,
    };

    const response = await this.sendRequest(
      fullRequest,
      request.timeout ?? DEFAULT_TIMEOUT
    );

    if (isExecuteResponse(response)) {
      return response;
    }

    throw new ProtocolClientError(
      ClientErrorCode.REQUEST_FAILED,
      `Unexpected response type: ${(response as ProtocolMessage).type}`,
      fullRequest.id
    );
  }

  /**
   * Read a file from the VM
   * @param path - Absolute file path
   * @param timeout - Request timeout in milliseconds
   * @returns Promise resolving to file read response
   * @throws {ProtocolClientError} On timeout, connection error, or read failure
   */
  async readFile(path: string, timeout = DEFAULT_TIMEOUT): Promise<FileReadResponse> {
    const request: FileReadRequest = {
      id: randomUUID(),
      type: "file_read",
      path,
    };

    const response = await this.sendRequest(request, timeout);

    if (isFileReadResponse(response)) {
      return response;
    }

    throw new ProtocolClientError(
      ClientErrorCode.REQUEST_FAILED,
      `Unexpected response type: ${(response as ProtocolMessage).type}`,
      request.id
    );
  }

  /**
   * Write a file to the VM
   * @param path - Absolute file path
   * @param content - File content as Buffer
   * @param mode - File permissions (octal, e.g., 0o644)
   * @param timeout - Request timeout in milliseconds
   * @returns Promise that resolves when write completes
   * @throws {ProtocolClientError} On timeout, connection error, or write failure
   */
  async writeFile(
    path: string,
    content: Buffer,
    mode?: number,
    timeout = DEFAULT_TIMEOUT
  ): Promise<void> {
    const request: FileWriteRequest = {
      id: randomUUID(),
      type: "file_write",
      path,
      content: content.toString("base64"),
      mode,
    };

    const response = await this.sendRequest(request, timeout);

    if (isErrorResponse(response)) {
      throw new ProtocolClientError(
        ClientErrorCode.REQUEST_FAILED,
        `${response.code}: ${response.message}`,
        request.id
      );
    }

    // Success - no specific response type for write
  }

  /**
   * Execute a command with streaming output
   * @param request - Execute request (id will be generated if not provided)
   * @param handlers - Stream handlers for output
   * @returns Promise that resolves when execution completes
   * @throws {ProtocolClientError} On streaming error
   */
  async executeStreaming(
    request: Omit<ExecuteRequest, "id" | "type">,
    handlers: StreamHandlers
  ): Promise<void> {
    const fullRequest: ExecuteRequest = {
      id: randomUUID(),
      type: "execute",
      ...request,
    };

    return new Promise((resolve, reject) => {
      const wrappedHandlers: StreamHandlers = {
        ...handlers,
        onExit: (exitCode) => {
          handlers.onExit?.(exitCode);
          resolve();
        },
        onError: (error) => {
          handlers.onError?.(error);
          reject(
            new ProtocolClientError(
              ClientErrorCode.STREAMING_ERROR,
              error.message,
              fullRequest.id,
              error
            )
          );
        },
      };

      this.sendRequest(
        fullRequest,
        request.timeout ?? DEFAULT_TIMEOUT,
        true,
        wrappedHandlers
      ).catch(reject);
    });
  }

  /**
   * Cancel a pending request by ID
   * @param requestId - ID of request to cancel
   * @returns True if request was found and cancelled
   */
  cancelRequest(requestId: string): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(requestId);
    pending.reject(
      new ProtocolClientError(
        ClientErrorCode.CANCELLED,
        "Request was cancelled",
        requestId
      )
    );
    return true;
  }

  /**
   * Get the number of pending requests
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Check if the client is closed
   */
  get closed(): boolean {
    return this.isClosed;
  }

  /**
   * Close the client and cancel all pending requests
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(
        new ProtocolClientError(
          ClientErrorCode.CONNECTION_CLOSED,
          "Client closed",
          id
        )
      );
    }
    this.pendingRequests.clear();

    // Close connection
    this.connection.close();

    this.emit("close");
    this.removeAllListeners();
  }
}
